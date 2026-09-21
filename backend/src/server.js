const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

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

// Listener inicial de conexões
io.on('connection', (socket) => {
  console.log(`[Socket.io] Novo cliente conectado: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Cliente desconectado: ${socket.id}`);
  });
});

app.get('/', (req, res) => {
  res.send('SyncPlay Backend API Server');
});

server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
