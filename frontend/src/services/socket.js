import { io } from 'socket.io-client';

// JWT padrão para testes rápidos ou sessões
const TEMP_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImIxYzg1MDhiLWY5OGMtNGI5ZC04OWY0LTNmYzA5OTczZTE3NiIsImVtYWlsIjoidGVzdEBzeW5jcGxheS5jb20iLCJpYXQiOjE3OTAwMTcwNTMsImV4cCI6MTc5MDYyMTg1M30.bHHwKS1KdSd7spC-4Ve6wV9mm24ZRArOAQfoXzW1BNg';

export const API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL;

export const getStoredToken = () => {
  return localStorage.getItem('syncplay_token') || TEMP_JWT;
};

export const socket = io(SOCKET_URL, {
  autoConnect: true,
  auth: {
    token: getStoredToken(),
  },
});

export const updateSocketAuth = (token) => {
  if (token) {
    localStorage.setItem('syncplay_token', token);
  } else {
    localStorage.removeItem('syncplay_token');
  }
  socket.auth = { token: getStoredToken() };
  if (socket.connected) {
    socket.disconnect().connect();
  } else {
    socket.connect();
  }
};

socket.on('connect', () => {
  console.log('[Socket.io] Conectado ao servidor com ID:', socket.id);
});

socket.on('disconnect', () => {
  console.log('[Socket.io] Desconectado do servidor');
});
