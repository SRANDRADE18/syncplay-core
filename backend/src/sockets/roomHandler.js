const crypto = require('crypto');
const prisma = require('../config/prisma');
const { roomsState, socketRoomMap } = require('./roomState');
const { withRetry } = require('../utils/retry');
const { getUserColor, getInitials } = require('../utils/avatar');

function registerRoomHandlers(io, socket) {
  // 1. Criação de Sala
  socket.on('create_room', async (data) => {
    const { video_url, roomName } = data || {};
    const roomId = crypto.randomUUID();

    const finalVideoUrl =
      video_url && video_url.trim()
        ? video_url.trim()
        : 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const finalRoomName =
      roomName && roomName.trim() ? roomName.trim() : 'Nova Sessão SyncPlay';
    const newToken = crypto.randomUUID();

    // 1. Instancia imediatamente na memória RAM (Zero I/O blocking para resposta instantânea)
    roomsState[roomId] = {
      hostSocketId: socket.id,
      hostToken: newToken,
      isPlaying: false,
      lastTimestamp: 0,
      lastUpdated: Date.now(),
      hostTimeout: null,
      videoUrl: finalVideoUrl,
      roomName: finalRoomName,
      messages: [],
      participants: {},
    };

    socket.join(roomId);
    socketRoomMap[socket.id] = roomId;
    console.log(`[Socket.io] Sala ${roomId} CRIADA por ${socket.id} (User: ${socket.user?.id || 'anon'}, Video: ${finalVideoUrl})`);

    // Notifica o cliente imediatamente com confirmação e token de anfitrião
    socket.emit('room_created', {
      roomId,
      hostToken: newToken,
      isHost: true,
      videoUrl: finalVideoUrl,
      roomName: finalRoomName,
    });

    // 2. Persistência assíncrona resiliente no PostgreSQL (não bloqueia a sala se o banco estiver oscilando)
    withRetry(async () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 1);

      await prisma.user.upsert({
        where: { id: socket.user.id },
        update: { premium_until: futureDate },
        create: {
          id: socket.user.id,
          email: socket.user.email || 'user@syncplay.com',
          password: await require('bcryptjs').hash('123456', 10),
          premium_until: futureDate,
        },
      });

      await prisma.room.create({
        data: {
          id: roomId,
          title: finalRoomName,
          host_id: socket.user.id,
          video_url: finalVideoUrl,
        },
      });
    });
  });

  // 2. Alteração de URL do Vídeo durante a sessão
  socket.on('change_video_url', async (data) => {
    const { roomId, videoUrl } = data || {};
    if (!roomsState[roomId]) return;
    if (socket.id !== roomsState[roomId].hostSocketId) {
      console.warn(`[Security] Socket ${socket.id} tentou trocar vídeo sem permissão.`);
      return;
    }
    const cleanUrl = videoUrl.trim().replace(/^http:\/\//i, 'https://');
    roomsState[roomId].videoUrl = cleanUrl;
    roomsState[roomId].lastTimestamp = 0;
    roomsState[roomId].isPlaying = false;
    roomsState[roomId].lastUpdated = Date.now();

    io.to(roomId).emit('video_url_changed', { videoUrl: cleanUrl });

    withRetry(() =>
      prisma.room.update({
        where: { id: roomId },
        data: { video_url: cleanUrl },
      })
    );
  });

  // 3. Exclusão de sala
  socket.on('delete_room', async (data) => {
    const { roomId } = data || {};
    if (roomsState[roomId]) {
      io.to(roomId).emit('room_deleted', { roomId });
      delete roomsState[roomId];
    }
    withRetry(() =>
      prisma.room.update({
        where: { id: roomId },
        data: { is_active: false },
      })
    );
  });

  // 4. Ingresso em Sala (Zero I/O no banco, leitura de RAM)
  socket.on('join_room', (data) => {
    const roomId = typeof data === 'string' ? data : data.roomId;
    const incomingToken = typeof data === 'string' ? null : data.hostToken;
    const clientUser = typeof data === 'string' ? null : data.user;

    if (!roomsState[roomId]) {
      socket.emit('join_rejected', {
        message: 'Sala não encontrada, já desativada ou ID inválido.',
      });
      return;
    }

    if (!roomsState[roomId].messages) roomsState[roomId].messages = [];
    if (!roomsState[roomId].participants) roomsState[roomId].participants = {};

    socket.join(roomId);
    socketRoomMap[socket.id] = roomId;

    let assignedIsHost = false;
    let assignedToken = null;

    if (incomingToken && incomingToken === roomsState[roomId].hostToken) {
      roomsState[roomId].hostSocketId = socket.id;
      assignedIsHost = true;
      assignedToken = incomingToken;

      if (roomsState[roomId].hostTimeout) {
        clearTimeout(roomsState[roomId].hostTimeout);
        roomsState[roomId].hostTimeout = null;
        console.log(`[Socket.io] Sala ${roomId} salva da destruição. Host verificado retornou.`);
      }
    }

    // Identidade do usuário conectado
    const effectiveName =
      clientUser?.name ||
      socket.user?.name ||
      (socket.user?.email
        ? socket.user.email === 'test@syncplay.com'
          ? 'Luna Martins'
          : socket.user.email.split('@')[0]
        : 'Usuário');
    const effectiveInitials = clientUser?.initials || getInitials(effectiveName);
    const effectiveColor = clientUser?.color || getUserColor(effectiveName);
    const userId = clientUser?.id || socket.user?.id || socket.id;

    // Registra participante ativo na sala
    roomsState[roomId].participants[socket.id] = {
      socketId: socket.id,
      id: userId,
      name: effectiveName,
      initials: effectiveInitials,
      color: effectiveColor,
      isHost: assignedIsHost,
    };

    console.log(`[Socket.io] ${effectiveName} (${socket.id}) conectado à sala ${roomId} como ${assignedIsHost ? 'Host' : 'Espectador'}`);

    // Emite atribuição de papel
    socket.emit('role_assigned', {
      isHost: assignedIsHost,
      hostToken: assignedToken,
      videoUrl: roomsState[roomId].videoUrl,
      roomName: roomsState[roomId].roomName || 'Sessão SyncPlay',
    });

    // Envia histórico de chat da sala
    socket.emit('chat_history', roomsState[roomId].messages || []);

    // Atualiza lista de participantes online para todos
    const currentParticipants = Object.values(roomsState[roomId].participants);
    io.to(roomId).emit('room_participants_update', {
      participants: currentParticipants,
      count: currentParticipants.length,
    });

    // Mensagem de sistema padrão Discord para entrada
    const joinMsg = {
      id: crypto.randomUUID(),
      roomId,
      isSystem: true,
      systemType: 'join',
      text: `${effectiveName} entrou na sala. Digam oi! 👋`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
    };
    roomsState[roomId].messages.push(joinMsg);
    if (roomsState[roomId].messages.length > 200) roomsState[roomId].messages.shift();
    io.to(roomId).emit('new_chat_message', joinMsg);
  });

  // 5. Motor de Sincronização: Ação com broadcast restrito à sala
  socket.on('video_command', (data) => {
    const { roomId, action, timestamp } = data || {};

    // Blindagem anti-spoofing
    if (socket.id !== roomsState[roomId]?.hostSocketId) {
      console.warn(`[Security] Socket ${socket.id} tentou emitir comando na sala ${roomId} sem autoridade.`);
      return;
    }

    if (roomsState[roomId]) {
      roomsState[roomId].isPlaying = action === 'play';
      roomsState[roomId].lastTimestamp = Number(timestamp) || 0;
      roomsState[roomId].lastUpdated = Date.now();
    }

    socket.to(roomId).emit('sync_command', {
      action,
      timestamp,
    });
  });

  // 5.1 Heartbeat Periódico de Sincronização (mitiga drift acumulado em sessões longas)
  socket.on('video_heartbeat', (data) => {
    const { roomId, timestamp, isPlaying } = data || {};
    if (!roomId || !roomsState[roomId]) return;

    // Apenas o anfitrião legítimo pode sincronizar o batimento cardíaco da sala
    if (socket.id !== roomsState[roomId].hostSocketId) return;

    roomsState[roomId].isPlaying = !!isPlaying;
    roomsState[roomId].lastTimestamp = Number(timestamp) || 0;
    roomsState[roomId].lastUpdated = Date.now();

    socket.to(roomId).emit('sync_heartbeat', {
      timestamp: roomsState[roomId].lastTimestamp,
      isPlaying: roomsState[roomId].isPlaying,
    });
  });

  // 6. Tratamento do Late Joiner (Ingressante Tardio)
  socket.on('request_initial_state', (data) => {
    const roomId = typeof data === 'string' ? data : data.roomId;
    const state = roomsState[roomId];
    if (!state) return;

    let currentEstimatedTime = state.lastTimestamp;

    if (state.isPlaying) {
      const elapsedSeconds = (Date.now() - state.lastUpdated) / 1000;
      currentEstimatedTime += elapsedSeconds;
    }

    socket.emit('initial_state_response', {
      isPlaying: state.isPlaying,
      timestamp: currentEstimatedTime,
      videoUrl: state.videoUrl,
    });
  });

  // 7. Desconexão e Gestão de Tolerância a Falhas
  socket.on('disconnect', () => {
    console.log(`[Socket.io] Cliente desconectado: ${socket.id}`);

    const roomId = socketRoomMap[socket.id];
    if (!roomId) return;

    const state = roomsState[roomId];
    if (!state) {
      delete socketRoomMap[socket.id];
      return;
    }

    // Remove participante da sala e notifica os restantes
    if (state.participants && state.participants[socket.id]) {
      const leavingUser = state.participants[socket.id];
      delete state.participants[socket.id];

      const remaining = Object.values(state.participants);
      io.to(roomId).emit('room_participants_update', {
        participants: remaining,
        count: remaining.length,
      });

      const leaveMsg = {
        id: crypto.randomUUID(),
        roomId,
        isSystem: true,
        systemType: 'leave',
        text: `${leavingUser.name} saiu da sala.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now(),
      };
      if (state.messages) {
        state.messages.push(leaveMsg);
        if (state.messages.length > 200) state.messages.shift();
      }
      io.to(roomId).emit('new_chat_message', leaveMsg);
    }

    // Gestão de Queda do Anfitrião (30 segundos de tolerância)
    if (state.hostSocketId === socket.id) {
      console.log(`[Socket.io] ALERTA: Host da sala ${roomId} desconectou.`);
      state.isPlaying = false;
      socket.to(roomId).emit('sync_command', { action: 'pause', timestamp: state.lastTimestamp });

      state.hostTimeout = setTimeout(async () => {
        if (roomsState[roomId]) {
          console.log(`[Socket.io] TEARDOWN: Timeout do host expirado. Destruindo sala ${roomId}`);
          socket.to(roomId).emit('host_timeout_kick');
          delete roomsState[roomId];

          await withRetry(() =>
            prisma.room.update({
              where: { id: roomId },
              data: { is_active: false },
            })
          );
        }
      }, 30000);
    }

    // Limpeza por Abandono da Sala
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room || room.size === 0) {
      console.log(`[Socket.io] TEARDOWN: Sala ${roomId} vazia. Removendo estado.`);
      if (roomsState[roomId]?.hostTimeout) clearTimeout(roomsState[roomId].hostTimeout);
      delete roomsState[roomId];

      withRetry(() =>
        prisma.room.update({
          where: { id: roomId },
          data: { is_active: false },
        })
      );
    }

    delete socketRoomMap[socket.id];
  });
}

module.exports = {
  registerRoomHandlers,
};
