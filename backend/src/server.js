const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const fs = require('fs');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error("ERRO FATAL: JWT_SECRET não definido no .env");
  process.exit(1);
}

// Utilitário de Retry
async function withRetry(fn, retries = 3, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) {
        console.error(`[withRetry] Falha final após ${retries} tentativas:`, error);
        fs.appendFileSync('dead_letter.log', `${new Date().toISOString()} - ${error.message}\n`);
        return; // Retorna sem throw para não derrubar o Node silenciosamente
      }
      console.warn(`[withRetry] Tentativa ${i + 1} falhou. Tentando em ${delayMs}ms...`);
      await new Promise(res => setTimeout(res, delayMs));
    }
  }
}

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do CORS para aceitar requisições do frontend
app.use(cors({
  origin: 'http://localhost:5173', // URL padrão do Vite
  methods: ['GET', 'POST'],
}));

app.use(express.json());

const server = http.createServer(app);

// Inicialização do Socket.io
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST'],
  }
});

// Dicionário em memória: { [roomId]: { hostSocketId, isPlaying, lastTimestamp, lastUpdated, hostTimeout, messages: [], participants: {} } }
const roomsState = {};
// Dicionário paralelo para O(1) lookup de qual sala o socket pertencia
const socketRoomMap = {};

// Paleta de cores moderna estilo Discord / SyncPlay para avatares
const DISCORD_AVATAR_GRADIENTS = [
  'bg-gradient-to-tr from-[#5865F2] to-[#7983F5]', // Blurple Discord
  'bg-gradient-to-tr from-[#6366f1] to-[#a855f7]', // Roxo / Índigo
  'bg-gradient-to-tr from-[#06b6d4] to-[#3b82f6]', // Ciano / Azul
  'bg-gradient-to-tr from-[#ec4899] to-[#f43f5e]', // Rosa / Cereja
  'bg-gradient-to-tr from-[#10b981] to-[#14b8a6]', // Esmeralda / Teal
  'bg-gradient-to-tr from-[#f59e0b] to-[#ea580c]', // Âmbar / Laranja
  'bg-gradient-to-tr from-[#8b5cf6] to-[#ec4899]', // Violeta / Magenta
  'bg-gradient-to-tr from-[#3b82f6] to-[#1d4ed8]', // Azul Royal
];

function getUserColor(str = '') {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % DISCORD_AVATAR_GRADIENTS.length;
  return DISCORD_AVATAR_GRADIENTS[index];
}

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// MIDDLEWARE JWT (Stateless - Sem Banco de Dados)
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: Token missing'));
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded.name) {
      decoded.name = decoded.email === 'test@syncplay.com' ? 'Luna Martins' : (decoded.email ? decoded.email.split('@')[0] : 'Usuário');
    }
    socket.user = decoded; // { id, email, name, ... }
    next();
  } catch (err) {
    return next(new Error('Authentication error: Invalid token'));
  }
});

// Listener inicial de conexões
io.on('connection', (socket) => {
  console.log(`[Socket.io] Novo cliente conectado: ${socket.id} (User ID: ${socket.user.id})`);

  // 1. Criação de Sala (I/O)
  socket.on('create_room', async (data) => {
    const { video_url, roomName } = data || {};
    const roomId = crypto.randomUUID(); // Força geração segura de UUID pelo backend

    try {
      let dbUser = await prisma.user.findUnique({
        where: { id: socket.user.id }
      });

      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 1);

      if (!dbUser) {
        dbUser = await prisma.user.upsert({
          where: { id: socket.user.id },
          update: { premium_until: futureDate },
          create: {
            id: socket.user.id,
            email: socket.user.email || 'user@syncplay.com',
            password: 'hashed_password_dummy',
            premium_until: futureDate
          }
        });
      } else if (!dbUser.premium_until || new Date(dbUser.premium_until) < new Date()) {
        dbUser = await prisma.user.update({
          where: { id: dbUser.id },
          data: { premium_until: futureDate }
        });
      }

      const finalVideoUrl = video_url && video_url.trim() ? video_url.trim() : 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      const finalRoomName = roomName && roomName.trim() ? roomName.trim() : 'Nova Sessão SyncPlay';

      await prisma.room.create({
        data: {
          id: roomId,
          host_id: socket.user.id,
          video_url: finalVideoUrl
        }
      });

      const newToken = crypto.randomUUID();
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
        participants: {}
      };

      socket.join(roomId);
      socketRoomMap[socket.id] = roomId;
      console.log(`[Socket.io] Sala ${roomId} CRIADA pelo socket ${socket.id} (User: ${socket.user.id}, Video: ${finalVideoUrl})`);

      socket.emit('room_created', {
        roomId,
        hostToken: newToken,
        isHost: true,
        videoUrl: finalVideoUrl,
        roomName: finalRoomName
      });
    } catch (err) {
      console.error('Erro interno ao criar sala:', err);
      socket.emit('creation_rejected', { message: 'Erro interno ao criar sala no banco.' });
    }
  });

  // Alterar URL do Vídeo durante a sessão
  socket.on('change_video_url', async (data) => {
    const { roomId, videoUrl } = data;
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

    withRetry(() => prisma.room.update({
      where: { id: roomId },
      data: { video_url: cleanUrl }
    }));
  });

  // Excluir sala
  socket.on('delete_room', async (data) => {
    const { roomId } = data;
    if (roomsState[roomId]) {
      io.to(roomId).emit('room_deleted', { roomId });
      delete roomsState[roomId];
    }
    withRetry(() => prisma.room.update({
      where: { id: roomId },
      data: { is_active: false }
    }));
  });

  // 1.5. Isolamento de Tráfego (Leitura de RAM, Zero I/O DB)
  socket.on('join_room', (data) => {
    const roomId = typeof data === 'string' ? data : data.roomId;
    const incomingToken = typeof data === 'string' ? null : data.hostToken;
    const clientUser = typeof data === 'string' ? null : data.user;

    if (!roomsState[roomId]) {
      // Mitigação de DDoS: Falha instantânea se a sala não estiver na RAM
      socket.emit('join_rejected', { message: 'Sala não encontrada, já desativada ou ID inválido.' });
      return;
    }

    if (!roomsState[roomId].messages) roomsState[roomId].messages = [];
    if (!roomsState[roomId].participants) roomsState[roomId].participants = {};

    socket.join(roomId);
    socketRoomMap[socket.id] = roomId;
    console.log(`[Socket.io] Socket ${socket.id} ingressou na sala ${roomId}`);

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
    const effectiveName = clientUser?.name || socket.user?.name || (socket.user?.email ? (socket.user.email === 'test@syncplay.com' ? 'Luna Martins' : socket.user.email.split('@')[0]) : 'Usuário');
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
      isHost: assignedIsHost
    };

    console.log(`[Socket.io] ${effectiveName} (${socket.id}) conectado à sala ${roomId} como ${assignedIsHost ? 'Host' : 'Espectador'}`);

    // Emite atribuição de papel ao usuário
    socket.emit('role_assigned', {
      isHost: assignedIsHost,
      hostToken: assignedToken,
      videoUrl: roomsState[roomId].videoUrl,
      roomName: roomsState[roomId].roomName || 'Sessão SyncPlay'
    });

    // Envia histórico de chat da sala para quem acabou de entrar
    socket.emit('chat_history', roomsState[roomId].messages || []);

    // Atualiza lista de participantes online para todos na sala
    const currentParticipants = Object.values(roomsState[roomId].participants);
    io.to(roomId).emit('room_participants_update', {
      participants: currentParticipants,
      count: currentParticipants.length
    });

    // Mensagem de sistema padrão Discord para entrada de participante
    const joinMsg = {
      id: crypto.randomUUID(),
      roomId,
      isSystem: true,
      systemType: 'join',
      text: `${effectiveName} entrou na sala. Digam oi! 👋`,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now()
    };
    roomsState[roomId].messages.push(joinMsg);
    if (roomsState[roomId].messages.length > 200) roomsState[roomId].messages.shift();
    io.to(roomId).emit('new_chat_message', joinMsg);
  });

  // 2. Motor de Sincronização: Intercepta a ação e faz o broadcast restrito à sala
  socket.on('video_command', (data) => {
    const { roomId, action, timestamp } = data;

    // BLINDAGEM ANTI-SPOOFING: Verifica se quem mandou é o anfitrião verificado atual
    if (socket.id !== roomsState[roomId]?.hostSocketId) {
      console.warn(`[Security] Socket ${socket.id} tentou emitir comando na sala ${roomId} sem autoridade! Bloqueado.`);
      return;
    }

    if (roomsState[roomId]) {
      roomsState[roomId].isPlaying = (action === 'play');
      roomsState[roomId].lastTimestamp = Number(timestamp) || 0;
      roomsState[roomId].lastUpdated = Date.now();
    }

    // Repassa aos outros usuários na sala
    socket.to(roomId).emit('sync_command', {
      action,
      timestamp
    });
  });

  // 3. Tratamento do Late Joiner
  socket.on('request_initial_state', (data) => {
    const roomId = typeof data === 'string' ? data : data.roomId;
    const state = roomsState[roomId];
    if (!state) return;

    let currentEstimatedTime = state.lastTimestamp;

    // Se o vídeo estava rodando, calcula o avanço com base no tempo decorrido
    if (state.isPlaying) {
      const elapsedSeconds = (Date.now() - state.lastUpdated) / 1000;
      currentEstimatedTime += elapsedSeconds;
    }

    socket.emit('initial_state_response', {
      isPlaying: state.isPlaying,
      timestamp: currentEstimatedTime,
      videoUrl: state.videoUrl
    });
  });

  // 4. Chat em Tempo Real estilo Discord
  socket.on('send_chat_message', (data) => {
    const { roomId, text, user, replyTo } = data || {};
    if (!roomId || !text || !text.trim()) return;

    const sender = roomsState[roomId]?.participants?.[socket.id];
    const authorName = sender?.name || user?.name || socket.user?.name || (socket.user?.email ? socket.user.email.split('@')[0] : 'Usuário');
    const initials = sender?.initials || user?.initials || getInitials(authorName);
    const color = sender?.color || user?.color || getUserColor(authorName);
    const isHost = roomsState[roomId]?.hostSocketId === socket.id;

    const msg = {
      id: crypto.randomUUID(),
      roomId,
      user: {
        id: socket.user?.id || sender?.id || socket.id,
        name: authorName,
        initials,
        color,
        isHost
      },
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      reactions: [],
      replyTo: replyTo || null
    };

    if (roomsState[roomId]) {
      if (!roomsState[roomId].messages) roomsState[roomId].messages = [];
      roomsState[roomId].messages.push(msg);
      if (roomsState[roomId].messages.length > 250) {
        roomsState[roomId].messages.shift();
      }
    }

    io.to(roomId).emit('new_chat_message', msg);
  });

  // 5. Reações de Mensagem (Toggle estilo Discord)
  socket.on('chat_reaction', (data) => {
    const { roomId, messageId, emoji } = data || {};
    if (!roomId || !messageId || !emoji) return;

    const userId = socket.user?.id || socket.id;
    const userName = socket.user?.name || 'Usuário';

    if (roomsState[roomId]?.messages) {
      const msg = roomsState[roomId].messages.find((m) => m.id === messageId);
      if (msg) {
        msg.reactions = msg.reactions || [];
        const rIndex = msg.reactions.findIndex((r) => r.emoji === emoji);

        if (rIndex === -1) {
          msg.reactions.push({ emoji, count: 1, users: [userId], userNames: [userName] });
        } else {
          const r = msg.reactions[rIndex];
          r.users = r.users || [];
          r.userNames = r.userNames || [];

          const uIdx = r.users.indexOf(userId);
          if (uIdx !== -1) {
            r.users.splice(uIdx, 1);
            r.userNames.splice(uIdx, 1);
            r.count = Math.max(0, r.count - 1);
          } else {
            r.users.push(userId);
            r.userNames.push(userName);
            r.count += 1;
          }

          if (r.count <= 0) {
            msg.reactions.splice(rIndex, 1);
          }
        }

        io.to(roomId).emit('chat_reaction_update', { messageId, reactions: msg.reactions });
        return;
      }
    }

    io.to(roomId).emit('chat_reaction_update', { messageId, emoji, userId });
  });

  // 6. Exclusão de Mensagem
  socket.on('delete_chat_message', (data) => {
    const { roomId, messageId } = data || {};
    if (!roomId || !messageId) return;

    if (roomsState[roomId]?.messages) {
      const msgIndex = roomsState[roomId].messages.findIndex((m) => m.id === messageId);
      if (msgIndex !== -1) {
        const msg = roomsState[roomId].messages[msgIndex];
        const isAuthor = msg.user?.id === (socket.user?.id || socket.id);
        const isHost = roomsState[roomId].hostSocketId === socket.id;

        if (isAuthor || isHost) {
          roomsState[roomId].messages.splice(msgIndex, 1);
          io.to(roomId).emit('chat_message_deleted', { messageId });
        }
      }
    }
  });

  // 7. Indicador "digitando..." (Typing indicator)
  socket.on('user_typing', (data) => {
    const { roomId, isTyping } = data || {};
    if (!roomId) return;
    const sender = roomsState[roomId]?.participants?.[socket.id];
    const name = sender?.name || socket.user?.name || 'Alguém';
    socket.to(roomId).emit('user_typing_update', {
      userId: socket.user?.id || socket.id,
      name,
      isTyping: !!isTyping
    });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Cliente desconectado: ${socket.id}`);

    const roomId = socketRoomMap[socket.id];
    if (!roomId) return;

    const state = roomsState[roomId];
    if (!state) {
      delete socketRoomMap[socket.id];
      return;
    }

    // Remove participante da sala e avisa os demais
    if (state.participants && state.participants[socket.id]) {
      const leavingUser = state.participants[socket.id];
      delete state.participants[socket.id];

      const remaining = Object.values(state.participants);
      io.to(roomId).emit('room_participants_update', {
        participants: remaining,
        count: remaining.length
      });

      const leaveMsg = {
        id: crypto.randomUUID(),
        roomId,
        isSystem: true,
        systemType: 'leave',
        text: `${leavingUser.name} saiu da sala.`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        timestamp: Date.now()
      };
      if (state.messages) {
        state.messages.push(leaveMsg);
        if (state.messages.length > 200) state.messages.shift();
      }
      io.to(roomId).emit('new_chat_message', leaveMsg);
    }

    // 1. Gestão de Queda do Anfitrião (Host Drop)
    if (state.hostSocketId === socket.id) {
      console.log(`[Socket.io] ALERTA: Host da sala ${roomId} desconectou.`);

      // Imobiliza a sessão para os espectadores
      state.isPlaying = false;
      socket.to(roomId).emit('sync_command', { action: 'pause', timestamp: state.lastTimestamp });

      // Inicia cronômetro de tolerância (30 segundos)
      state.hostTimeout = setTimeout(async () => {
        if (roomsState[roomId]) {
          console.log(`[Socket.io] TEARDOWN: Timeout do host expirado. Destruindo sala ${roomId}`);
          socket.to(roomId).emit('host_timeout_kick');
          delete roomsState[roomId];

          // Desativa sala no banco com Retry
          await withRetry(() => prisma.room.update({
            where: { id: roomId },
            data: { is_active: false }
          }));
        }
      }, 30000);
    }

    // 2. Limpeza Definitiva por Abandono
    const room = io.sockets.adapter.rooms.get(roomId);
    if (!room || room.size === 0) {
      console.log(`[Socket.io] TEARDOWN: Sala ${roomId} vazia. Removendo estado.`);
      if (roomsState[roomId]?.hostTimeout) clearTimeout(roomsState[roomId].hostTimeout);
      delete roomsState[roomId];

      // Desativa sala no banco com Retry
      withRetry(() => prisma.room.update({
        where: { id: roomId },
        data: { is_active: false }
      }));
    }

    // Libera a memória do dicionário reverso
    delete socketRoomMap[socket.id];
  });
});

// --- ROTAS HTTP ---

const bcrypt = require('bcryptjs');

// Helper para obter o IP do cliente no Express
function getClientIp(req) {
  return req.headers['x-forwarded-for'] || req.socket.remoteAddress;
}

app.post('/register', async (req, res) => {
  const { email, password, referred_by, name } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
  }

  const ip = getClientIp(req);

  try {
    const existingIp = await prisma.user.findFirst({
      where: { registration_ip: ip }
    });
    if (existingIp && ip !== '::1' && ip !== '127.0.0.1') {
      return res.status(429).json({ error: 'Limite de criação de conta por IP atingido.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newReferralCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    const displayName = (name && name.trim()) ? name.trim() : email.split('@')[0];

    // Transação Atômica do Growth Loop
    const result = await prisma.$transaction(async (tx) => {
      let referrerUser = null;

      if (referred_by) {
        referrerUser = await tx.user.findUnique({
          where: { referral_code: referred_by }
        });
        if (!referrerUser) {
          throw new Error('Código de indicação inválido.');
        }
      }

      const newUser = await tx.user.create({
        data: {
          name: displayName,
          email,
          password: hashedPassword,
          referral_code: newReferralCode,
          registration_ip: ip,
          premium_until: null
        }
      });

      if (referrerUser) {
        const currentPremium = referrerUser.premium_until && new Date(referrerUser.premium_until) > new Date()
          ? new Date(referrerUser.premium_until)
          : new Date();
        currentPremium.setDate(currentPremium.getDate() + 30);

        await tx.user.update({
          where: { id: referrerUser.id },
          data: { premium_until: currentPremium }
        });

        await tx.referralEvent.create({
          data: {
            referrer_id: referrerUser.id,
            referred_id: newUser.id
          }
        });
      }

      return newUser;
    });

    res.status(201).json({
      message: 'Usuário criado com sucesso.',
      user: {
        id: result.id,
        name: result.name || displayName,
        email: result.email,
        referral_code: result.referral_code
      }
    });

  } catch (error) {
    if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
      return res.status(409).json({ error: 'E-mail já está em uso.' });
    }
    console.error('Erro no registro:', error);
    res.status(400).json({ error: error.message || 'Erro ao criar usuário.' });
  }
});

app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'E-mail não cadastrado ou senha incorreta.' });
    }

    const isValid = await bcrypt.compare(password, user.password).catch(() => false);
    if (!isValid && user.password !== password) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }

    const displayName = user.name || (user.email === 'test@syncplay.com' ? 'Luna Martins' : user.email.split('@')[0]);
    const nameParts = displayName.trim().split(/\s+/).filter(Boolean);
    const initials = nameParts.length > 1
      ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
      : displayName.substring(0, 2).toUpperCase();

    const token = jwt.sign(
      { id: user.id, email: user.email, name: displayName },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: displayName,
        initials,
        plan: 'Plano Vibe',
        daysLeft: 23,
        referral_code: user.referral_code || 'LUNA30',
        premium_until: user.premium_until
      }
    });
  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ error: 'Erro interno ao realizar login.' });
  }
});

app.get('/', (req, res) => {
  res.send('SyncPlay Backend API Server');
});

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
