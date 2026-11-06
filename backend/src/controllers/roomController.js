const crypto = require('crypto');
const prisma = require('../config/prisma');
const { roomsState } = require('../sockets/roomState');

/**
 * Lista as salas ativas do usuário autenticado
 */
async function listRooms(req, res) {
  try {
    const rooms = await prisma.room.findMany({
      where: {
        host_id: req.user.id,
        is_active: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const formatted = rooms.map((room) => {
      const isYouTube = room.video_url.includes('youtube.com') || room.video_url.includes('youtu.be');
      const memoryState = roomsState[room.id];
      const activeParticipants = memoryState?.participants
        ? Object.keys(memoryState.participants).length
        : 1;

      return {
        id: room.id,
        title: room.title || 'Sessão SyncPlay',
        videoTitle: room.title || 'Vídeo Sincronizado',
        type: isYouTube ? 'YOUTUBE' : 'VÍDEO EXTERNO',
        date: new Date(room.createdAt).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        participants: activeParticipants,
        image: isYouTube ? '/maratona.jpg' : '/horizonte_neon.jpg',
        isPrimary: false,
        url: room.video_url,
        createdAt: room.createdAt,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Erro ao listar salas:', error);
    res.status(500).json({ error: 'Erro ao buscar salas no banco.' });
  }
}

/**
 * Obtém detalhes de uma sala específica
 */
async function getRoomById(req, res) {
  const { id } = req.params;

  try {
    const room = await prisma.room.findFirst({
      where: { id, is_active: true },
    });

    if (!room) {
      return res.status(404).json({ error: 'Sala não encontrada ou desativada.' });
    }

    const memoryState = roomsState[room.id];

    res.json({
      id: room.id,
      title: room.title,
      video_url: memoryState?.videoUrl || room.video_url,
      host_id: room.host_id,
      isPlaying: memoryState?.isPlaying || false,
      createdAt: room.createdAt,
    });
  } catch (error) {
    console.error('Erro ao buscar sala por ID:', error);
    res.status(500).json({ error: 'Erro interno ao consultar sala.' });
  }
}

/**
 * Criação de sala via HTTP REST
 */
async function createRoom(req, res) {
  const { title, video_url } = req.body;
  const roomId = crypto.randomUUID();
  const finalTitle = title && title.trim() ? title.trim() : 'Nova Sessão SyncPlay';
  const finalVideoUrl =
    video_url && video_url.trim()
      ? video_url.trim()
      : 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

  try {
    const newRoom = await prisma.room.create({
      data: {
        id: roomId,
        title: finalTitle,
        host_id: req.user.id,
        video_url: finalVideoUrl,
        is_active: true,
      },
    });

    // Inicializa a sala na memória
    const hostToken = crypto.randomUUID();
    roomsState[roomId] = {
      hostSocketId: null,
      hostToken,
      isPlaying: false,
      lastTimestamp: 0,
      lastUpdated: Date.now(),
      hostTimeout: null,
      videoUrl: finalVideoUrl,
      roomName: finalTitle,
      messages: [],
      participants: {},
    };

    res.status(201).json({
      message: 'Sala criada com sucesso.',
      room: {
        id: newRoom.id,
        title: newRoom.title,
        video_url: newRoom.video_url,
        hostToken,
      },
    });
  } catch (error) {
    console.error('Erro ao criar sala via REST:', error);
    res.status(500).json({ error: 'Erro ao salvar sala no banco de dados.' });
  }
}

/**
 * Soft delete de sala
 */
async function deleteRoom(req, res) {
  const { id } = req.params;

  try {
    const room = await prisma.room.findUnique({
      where: { id },
    });

    if (!room) {
      return res.status(404).json({ error: 'Sala não encontrada.' });
    }

    if (room.host_id !== req.user.id) {
      return res.status(403).json({ error: 'Sem permissão para excluir esta sala.' });
    }

    await prisma.room.update({
      where: { id },
      data: { is_active: false },
    });

    if (roomsState[id]) {
      delete roomsState[id];
    }

    res.json({ message: 'Sala excluída com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir sala:', error);
    res.status(500).json({ error: 'Erro ao excluir sala.' });
  }
}

module.exports = {
  listRooms,
  getRoomById,
  createRoom,
  deleteRoom,
};

