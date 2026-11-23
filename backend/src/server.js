const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const { PORT, CORS_ORIGIN } = require('./config/constants');
const authRoutes = require('./routes/authRoutes');
const roomRoutes = require('./routes/roomRoutes');
const { socketAuthMiddleware } = require('./middlewares/auth');
const { registerRoomHandlers } = require('./sockets/roomHandler');
const { registerChatHandlers } = require('./sockets/chatHandler');

const app = express();

// Configuração flexível de CORS para aceitar Vercel (*.vercel.app), localhost ou domínios customizados
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) return true;
  if (origin.endsWith('.vercel.app')) return true;
  return true; // Fallback permissivo para garantir que a apresentação nunca falhe por CORS
};

app.use(cors({
  origin: (origin, callback) => {
    callback(null, isOriginAllowed(origin));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

app.use(express.json());

// Rotas HTTP - montadas sob /api (para o roteamento de serviços da Vercel) e na raiz (para retrocompatibilidade local)
app.use('/api', authRoutes); // /api/login, /api/register
app.use('/api/auth', authRoutes); // /api/auth/login, /api/auth/register
app.use('/api/rooms', roomRoutes); // /api/rooms
app.use('/', authRoutes); // /login, /register (compatibilidade)
app.use('/auth', authRoutes); // /auth/login, /auth/register
app.use('/rooms', roomRoutes); // /rooms (compatibilidade)

app.get(['/', '/api'], (req, res) => {
  res.json({
    status: 'online',
    service: 'SyncPlay Core API',
    version: '1.0.0',
    endpoints: {
      auth: ['POST /api/login', 'POST /api/register'],
      rooms: ['GET /api/rooms', 'POST /api/rooms', 'GET /api/rooms/:id', 'DELETE /api/rooms/:id'],
    },
  });
});

const server = http.createServer(app);

// Inicialização do Socket.io com middleware de autenticação
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, isOriginAllowed(origin));
    },
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

io.use(socketAuthMiddleware);

io.on('connection', (socket) => {
  console.log(`[Socket.io] Novo cliente conectado: ${socket.id} (User ID: ${socket.user.id})`);

  registerRoomHandlers(io, socket);
  registerChatHandlers(io, socket);
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`[SyncPlay] Servidor rodando na porta ${PORT}`);
  });
}

module.exports = app;
module.exports.app = app;
module.exports.server = server;
