import { io } from 'socket.io-client';

// JWT temporário gerado pelo seed.js para testes de Integração de Estado
const TEMP_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImIxYzg1MDhiLWY5OGMtNGI5ZC04OWY0LTNmYzA5OTczZTE3NiIsImVtYWlsIjoidGVzdEBzeW5jcGxheS5jb20iLCJpYXQiOjE3OTAwMTcwNTMsImV4cCI6MTc5MDYyMTg1M30.bHHwKS1KdSd7spC-4Ve6wV9mm24ZRArOAQfoXzW1BNg';

// Ajustar a URL para a porta correta do servidor backend em ambiente de desenvolvimento
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  auth: {
    token: TEMP_JWT,
  },
});

socket.on('connect', () => {
  console.log('[Socket.io] Conectado ao servidor com ID:', socket.id);
});

socket.on('disconnect', () => {
  console.log('[Socket.io] Desconectado do servidor');
});
