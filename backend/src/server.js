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

// Configuração do CORS
app.use(cors({
  origin: CORS_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

app.use(express.json());

// Rotas HTTP
app.use('/', authRoutes); // Disponibiliza /register e /login diretamente na raiz
app.use('/auth', authRoutes); // Disponibiliza /auth/register e /auth/login
app.use('/rooms', roomRoutes); // Disponibiliza /rooms para CRUD de salas

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'SyncPlay Core API',
    version: '1.0.0',
    endpoints: {
      auth: ['POST /login', 'POST /register'],
      rooms: ['GET /rooms', 'POST /rooms', 'GET /rooms/:id', 'DELETE /rooms/:id'],
    },
  });
});

const server = http.createServer(app);

// Inicialização do Socket.io com middleware de autenticação
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
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

module.exports = { app, server };
