import { io } from 'socket.io-client';

// Ajustar a URL para a porta correta do servidor backend em ambiente de desenvolvimento
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

export const socket = io(SOCKET_URL, {
  autoConnect: true,
});

socket.on('connect', () => {
  console.log('[Socket.io] Conectado ao servidor com ID:', socket.id);
});

socket.on('disconnect', () => {
  console.log('[Socket.io] Desconectado do servidor');
});
