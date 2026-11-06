import { io } from 'socket.io-client';

// JWT padrão para testes rápidos ou sessões (válido até 2036 com id de Luna Martins)
const TEMP_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImIxYzg1MDhiLWY5OGMtNGI5ZC04OWY0LTNmYzA5OTczZTE3NiIsImVtYWlsIjoidGVzdEBzeW5jcGxheS5jb20iLCJuYW1lIjoiTHVuYSBNYXJ0aW5zIiwiaWF0IjoxNzkzOTczMDg5LCJleHAiOjIxMDkzMzMwODl9.uzQURZDZTRHwF-5EBHIwDXiX74E_mwQY6KYFL9pr_NU';

export const API_URL = import.meta.env.VITE_API_URL || import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';
export const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL;

export const getStoredToken = () => {
  const stored = localStorage.getItem('syncplay_token');
  if (stored) {
    try {
      const payload = JSON.parse(atob(stored.split('.')[1]));
      // Se o token salvo no localStorage estiver expirado, descarta e usa o token novo
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('syncplay_token');
        return TEMP_JWT;
      }
      return stored;
    } catch {
      localStorage.removeItem('syncplay_token');
    }
  }
  return TEMP_JWT;
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

socket.on('connect_error', (err) => {
  console.warn('[Socket.io] Erro de conexão com o servidor:', err.message);
});

socket.on('disconnect', (reason) => {
  console.log('[Socket.io] Desconectado do servidor. Motivo:', reason);
});
