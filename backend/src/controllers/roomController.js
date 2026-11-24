const crypto = require('crypto');
const prisma = require('../config/prisma');
const { roomsState } = require('../sockets/roomState');
const { getInitials, getUserColor } = require('../utils/avatar');

const PRESENCE_TTL_MS = 30000;

function normalizeParticipantsMap(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return { ...raw };
}

function pruneAndListParticipants(participantsMap) {
  const now = Date.now();
  const cleaned = {};
  const list = [];
  for (const [uid, p] of Object.entries(participantsMap)) {
    if (p && (!p.lastSeen || now - p.lastSeen <= PRESENCE_TTL_MS)) {
      cleaned[uid] = p;
      list.push(p);
    }
  }
  return { cleaned, list };
}

function normalizeMessages(raw) {
  if (Array.isArray(raw)) return [...raw];
  return [];
}

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
      const { list: dbParticipants } = pruneAndListParticipants(normalizeParticipantsMap(room.participants));
      const activeParticipants = memoryState?.participants
        ? Math.max(Object.keys(memoryState.participants).length, dbParticipants.length, 1)
        : Math.max(dbParticipants.length, 1);

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
        isPrimary: true,
        isHost: room.host_id === req.user.id,
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
 * Obtém detalhes e estado em tempo real de uma sala específica (e registra presença ativa)
 */
async function getRoomById(req, res) {
  const { id } = req.params;

  try {
    const room = await prisma.room.findFirst({
      where: { id, is_active: true },
    });

    if (!room) {
      return res.status(404).json({ error: 'Sala não encontrada ou já encerrada.' });
    }

    const isHost = room.host_id === req.user.id;
    const userName = req.user.name || (req.user.email ? req.user.email.split('@')[0] : 'Usuário');
    const userEntry = {
      id: req.user.id,
      name: userName,
      initials: getInitials(userName),
      color: getUserColor(userName),
      isHost,
      lastSeen: Date.now(),
    };

    const rawParticipants = normalizeParticipantsMap(room.participants);
    const isNewParticipant = !rawParticipants[req.user.id];
    rawParticipants[req.user.id] = userEntry;
    const { cleaned, list: activeParticipants } = pruneAndListParticipants(rawParticipants);

    let messages = normalizeMessages(room.messages);
    if (isNewParticipant) {
      messages.push({
        id: crypto.randomUUID(),
        roomId: room.id,
        isSystem: true,
        systemType: 'join',
        text: `${userName} entrou na sala. Digam oi! 👋`,
        time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
      });
      if (messages.length > 150) messages = messages.slice(-150);
    }

    // Atualiza presença (sem bloquear resposta caso haja contenção rápida)
    prisma.room.update({
      where: { id: room.id },
      data: {
        participants: cleaned,
        ...(isNewParticipant ? { messages } : {}),
      },
    }).catch(() => {});

    const memoryState = roomsState[room.id];
    const isPlaying = memoryState ? memoryState.isPlaying : Boolean(room.is_playing);
    const baseTime = memoryState ? memoryState.lastTimestamp : Number(room.playback_time || 0);
    const updatedAtMs = memoryState
      ? memoryState.lastUpdated
      : (room.state_updated_at ? new Date(room.state_updated_at).getTime() : Date.now());
    const estimatedTimestamp = isPlaying
      ? Math.max(0, baseTime + (Date.now() - updatedAtMs) / 1000)
      : Math.max(0, baseTime);

    res.json({
      id: room.id,
      title: room.title,
      video_url: memoryState?.videoUrl || room.video_url,
      host_id: room.host_id,
      isHost,
      isPlaying,
      timestamp: estimatedTimestamp,
      playbackRate: Number(room.playback_rate || 1.0),
      messages: memoryState?.messages?.length ? memoryState.messages : messages,
      participants: activeParticipants,
      createdAt: room.createdAt,
    });
  } catch (error) {
    console.error('Erro ao buscar sala por ID:', error);
    res.status(500).json({ error: 'Erro interno ao consultar sala.' });
  }
}

/**
 * Criação de sala via HTTP REST (funciona no desktop, celular e Vercel Serverless)
 */
async function createRoom(req, res) {
  const { title, video_url } = req.body;
  const roomId = crypto.randomUUID();
  const finalTitle = title && title.trim() ? title.trim() : 'Nova Sessão SyncPlay';
  const finalVideoUrl =
    video_url && video_url.trim()
      ? video_url.trim().replace(/^http:\/\//i, 'https://')
      : 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

  const userName = req.user.name || (req.user.email ? req.user.email.split('@')[0] : 'Usuário');
  const initialParticipants = {
    [req.user.id]: {
      id: req.user.id,
      name: userName,
      initials: getInitials(userName),
      color: getUserColor(userName),
      isHost: true,
      lastSeen: Date.now(),
    },
  };
  const initialMessages = [
    {
      id: crypto.randomUUID(),
      roomId,
      isSystem: true,
      systemType: 'join',
      text: `${userName} iniciou a sessão "${finalTitle}". Convide a galera! 🍿`,
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
    },
  ];

  try {
    const newRoom = await prisma.room.create({
      data: {
        id: roomId,
        title: finalTitle,
        host_id: req.user.id,
        video_url: finalVideoUrl,
        is_active: true,
        is_playing: false,
        playback_time: 0,
        playback_rate: 1.0,
        state_updated_at: new Date(),
        participants: initialParticipants,
        messages: initialMessages,
      },
    });

    const hostToken = crypto.randomUUID();
    roomsState[roomId] = {
      hostUserId: req.user.id,
      hostSocketId: null,
      hostToken,
      isPlaying: false,
      lastTimestamp: 0,
      lastUpdated: Date.now(),
      hostTimeout: null,
      videoUrl: finalVideoUrl,
      roomName: finalTitle,
      messages: [...initialMessages],
      participants: {},
    };

    res.status(201).json({
      message: 'Sala criada com sucesso.',
      room: {
        id: newRoom.id,
        title: newRoom.title,
        video_url: newRoom.video_url,
        host_id: newRoom.host_id,
        isHost: true,
        hostToken,
      },
    });
  } catch (error) {
    console.error('Erro ao criar sala via REST:', error);
    res.status(500).json({ error: 'Erro ao salvar sala no banco de dados.' });
  }
}

/**
 * Sincronização de reprodução via HTTP REST (Play, Pause, Seek, Velocidade e Troca de Vídeo)
 */
async function syncRoomState(req, res) {
  const { id } = req.params;
  const { action, isPlaying, timestamp, playbackRate, videoUrl } = req.body || {};

  try {
    const room = await prisma.room.findFirst({
      where: { id, is_active: true },
    });

    if (!room) {
      return res.status(404).json({ error: 'Sala não encontrada.' });
    }

    if (room.host_id !== req.user.id) {
      return res.status(403).json({ error: 'Apenas o anfitrião pode controlar a reprodução da sala.' });
    }

    const nextPlaying =
      typeof isPlaying === 'boolean'
        ? isPlaying
        : action === 'play'
        ? true
        : action === 'pause' || action === 'buffer'
        ? false
        : room.is_playing;

    const nextTime = timestamp !== undefined ? Math.max(0, Number(timestamp) || 0) : room.playback_time;
    const nextRate = playbackRate !== undefined ? Number(playbackRate) || 1.0 : room.playback_rate;
    const nextUrl =
      videoUrl && videoUrl.trim()
        ? videoUrl.trim().replace(/^http:\/\//i, 'https://')
        : room.video_url;

    const updated = await prisma.room.update({
      where: { id },
      data: {
        is_playing: nextPlaying,
        playback_time: nextTime,
        playback_rate: nextRate,
        video_url: nextUrl,
        state_updated_at: new Date(),
      },
    });

    if (roomsState[id]) {
      roomsState[id].isPlaying = nextPlaying;
      roomsState[id].lastTimestamp = nextTime;
      roomsState[id].lastUpdated = Date.now();
      roomsState[id].videoUrl = nextUrl;
    }

    res.json({
      ok: true,
      isPlaying: updated.is_playing,
      timestamp: updated.playback_time,
      playbackRate: updated.playback_rate,
      videoUrl: updated.video_url,
    });
  } catch (error) {
    console.error('Erro ao sincronizar estado da sala:', error);
    res.status(500).json({ error: 'Erro ao sincronizar estado da sala.' });
  }
}

/**
 * Envio de mensagem no chat via HTTP REST
 */
async function postRoomMessage(req, res) {
  const { id } = req.params;
  const { text, replyTo } = req.body || {};

  if (!text || !text.trim()) {
    return res.status(400).json({ error: 'Mensagem vazia.' });
  }

  try {
    const room = await prisma.room.findFirst({
      where: { id, is_active: true },
    });

    if (!room) {
      return res.status(404).json({ error: 'Sala não encontrada.' });
    }

    const userName = req.user.name || (req.user.email ? req.user.email.split('@')[0] : 'Usuário');
    const msg = {
      id: crypto.randomUUID(),
      roomId: id,
      user: {
        id: req.user.id,
        name: userName,
        initials: getInitials(userName),
        color: getUserColor(userName),
        isHost: room.host_id === req.user.id,
      },
      text: text.trim().slice(0, 1000),
      time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      reactions: [],
      replyTo: replyTo || null,
    };

    let messages = normalizeMessages(room.messages);
    messages.push(msg);
    if (messages.length > 150) messages = messages.slice(-150);

    await prisma.room.update({
      where: { id },
      data: { messages },
    });

    if (roomsState[id]?.messages) {
      roomsState[id].messages.push(msg);
    }

    res.status(201).json({ message: msg });
  } catch (error) {
    console.error('Erro ao enviar mensagem:', error);
    res.status(500).json({ error: 'Erro ao enviar mensagem.' });
  }
}

/**
 * Alterna reação emoji em uma mensagem via HTTP REST
 */
async function toggleMessageReaction(req, res) {
  const { id, messageId } = req.params;
  const { emoji } = req.body || {};

  if (!emoji) {
    return res.status(400).json({ error: 'Emoji é obrigatório.' });
  }

  try {
    const room = await prisma.room.findFirst({
      where: { id, is_active: true },
    });

    if (!room) {
      return res.status(404).json({ error: 'Sala não encontrada.' });
    }

    const userId = req.user.id;
    const userName = req.user.name || 'Usuário';
    const messages = normalizeMessages(room.messages);
    const msg = messages.find((m) => m.id === messageId);

    if (!msg) {
      return res.status(404).json({ error: 'Mensagem não encontrada.' });
    }

    msg.reactions = Array.isArray(msg.reactions) ? msg.reactions : [];
    const rIndex = msg.reactions.findIndex((r) => r.emoji === emoji);

    if (rIndex === -1) {
      msg.reactions.push({ emoji, count: 1, users: [userId], userNames: [userName] });
    } else {
      const r = msg.reactions[rIndex];
      r.users = Array.isArray(r.users) ? r.users : [];
      const uIdx = r.users.indexOf(userId);
      if (uIdx !== -1) {
        r.users.splice(uIdx, 1);
        r.count = Math.max(0, r.count - 1);
      } else {
        r.users.push(userId);
        r.count = (r.count || 0) + 1;
      }
      if (r.count <= 0) {
        msg.reactions.splice(rIndex, 1);
      }
    }

    await prisma.room.update({
      where: { id },
      data: { messages },
    });

    res.json({ messageId, reactions: msg.reactions });
  } catch (error) {
    console.error('Erro ao reagir à mensagem:', error);
    res.status(500).json({ error: 'Erro ao atualizar reação.' });
  }
}

/**
 * Exclui uma mensagem do chat via HTTP REST
 */
async function deleteRoomMessage(req, res) {
  const { id, messageId } = req.params;

  try {
    const room = await prisma.room.findFirst({
      where: { id, is_active: true },
    });

    if (!room) {
      return res.status(404).json({ error: 'Sala não encontrada.' });
    }

    const messages = normalizeMessages(room.messages);
    const idx = messages.findIndex((m) => m.id === messageId);
    if (idx === -1) {
      return res.status(404).json({ error: 'Mensagem não encontrada.' });
    }

    const msg = messages[idx];
    const isAuthor = msg.user?.id === req.user.id;
    const isHost = room.host_id === req.user.id;

    if (!isAuthor && !isHost) {
      return res.status(403).json({ error: 'Sem permissão para excluir esta mensagem.' });
    }

    messages.splice(idx, 1);
    await prisma.room.update({
      where: { id },
      data: { messages },
    });

    res.json({ messageId });
  } catch (error) {
    console.error('Erro ao excluir mensagem:', error);
    res.status(500).json({ error: 'Erro ao excluir mensagem.' });
  }
}

/**
 * Remove presença do usuário ao sair da sala
 */
async function leaveRoom(req, res) {
  const { id } = req.params;

  try {
    const room = await prisma.room.findFirst({
      where: { id, is_active: true },
    });
    if (room) {
      const map = normalizeParticipantsMap(room.participants);
      delete map[req.user.id];
      await prisma.room.update({
        where: { id },
        data: { participants: map },
      });
    }
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
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
  syncRoomState,
  postRoomMessage,
  toggleMessageReaction,
  deleteRoomMessage,
  leaveRoom,
  deleteRoom,
};

