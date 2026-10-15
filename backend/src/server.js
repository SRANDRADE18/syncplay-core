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

// Dicionário em memória: { [roomId]: { hostSocketId, isPlaying, lastTimestamp, lastUpdated, hostTimeout } }
const roomsState = {};
// Dicionário paralelo para O(1) lookup de qual sala o socket pertencia
const socketRoomMap = {};

// MIDDLEWARE JWT (Stateless - Sem Banco de Dados)
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error: Token missing'));
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded; // { id, email, ... }
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
        roomName: finalRoomName
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

    if (!roomsState[roomId]) {
      // Mitigação de DDoS: Falha instantânea se a sala não estiver na RAM
      socket.emit('join_rejected', { message: 'Sala não encontrada, já desativada ou ID inválido.' });
      return;
    }

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
    } else {
      console.log(`[Socket.io] Socket ${socket.id} entrou na sala ${roomId} como Espectador`);
    }

    socket.emit('role_assigned', {
      isHost: assignedIsHost,
      hostToken: assignedToken,
      videoUrl: roomsState[roomId].videoUrl,
      roomName: roomsState[roomId].roomName || 'Sessão SyncPlay'
    });
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

  // 4. Chat em Tempo Real
  socket.on('send_chat_message', (data) => {
    const { roomId, text, user } = data;
    if (!roomId || !text) return;
    const msg = {
      id: crypto.randomUUID(),
      roomId,
      user: user || { name: 'Luna Martins', initials: 'LM', color: 'from-purple-600 to-indigo-600' },
      text,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      reactions: []
    };
    io.to(roomId).emit('new_chat_message', msg);
  });

  socket.on('chat_reaction', (data) => {
    const { roomId, messageId, emoji, count } = data;
    io.to(roomId).emit('chat_reaction_update', { messageId, emoji, count });
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
  const { email, password, referred_by } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha são obrigatórios.' });
  }

  const ip = getClientIp(req);

  try {
    // 1. Defesa L1: Verifica se o IP já registrou uma conta recentemente
    // Como simplificação MVP, bloquearemos se o IP já existe na tabela User
    // Em produção, isso seria filtrado por data (ex: 1 conta por IP por dia).
    const existingIp = await prisma.user.findFirst({
      where: { registration_ip: ip }
    });
    if (existingIp && ip !== '::1' && ip !== '127.0.0.1') { // Ignora localhost para testes
      return res.status(429).json({ error: 'Limite de criação de conta por IP atingido.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newReferralCode = crypto.randomBytes(4).toString('hex').toUpperCase();

    // 2. Transação Atômica do Growth Loop
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
          email,
          password: hashedPassword,
          referral_code: newReferralCode,
          registration_ip: ip,
          // Bônus inicial nulo ou trial de 3 dias? Vamos deixar nulo por padrão.
          premium_until: null
        }
      });

      if (referrerUser) {
        // Incrementa 30 dias de premium para quem indicou
        const currentPremium = referrerUser.premium_until && new Date(referrerUser.premium_until) > new Date()
          ? new Date(referrerUser.premium_until)
          : new Date();
        currentPremium.setDate(currentPremium.getDate() + 30);

        await tx.user.update({
          where: { id: referrerUser.id },
          data: { premium_until: currentPremium }
        });

        // Registra o evento de indicação
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
      user: { id: result.id, email: result.email, referral_code: result.referral_code }
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

    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.email === 'test@syncplay.com' ? 'Luna Martins' : user.email.split('@')[0],
        initials: user.email === 'test@syncplay.com' ? 'LM' : user.email.substring(0, 2).toUpperCase(),
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
