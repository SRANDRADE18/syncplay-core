import { io } from 'socket.io-client';

const resolveApiUrl = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes(':5173')) {
    return '/api';
  }
  return 'http://localhost:3000';
};

const resolveSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  if (typeof window !== 'undefined' && window.location.origin && !window.location.origin.includes(':5173')) {
    return window.location.origin;
  }
  return 'http://localhost:3000';
};

export const API_URL = resolveApiUrl();
export const SOCKET_URL = resolveSocketUrl();

export const getStoredToken = () => {
  const stored = localStorage.getItem('syncplay_token');
  if (stored) {
    try {
      const payload = JSON.parse(atob(stored.split('.')[1]));
      // Se o token salvo no localStorage estiver expirado, descarta
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('syncplay_token');
        localStorage.removeItem('syncplay_user');
        return null;
      }
      return stored;
    } catch {
      localStorage.removeItem('syncplay_token');
      localStorage.removeItem('syncplay_user');
      return null;
    }
  }
  return null;
};

export const socket = io(SOCKET_URL, {
  autoConnect: Boolean(getStoredToken()),
  auth: {
    token: getStoredToken(),
  },
});

export const updateSocketAuth = (token) => {
  if (token) {
    localStorage.setItem('syncplay_token', token);
    socket.auth = { token };
    if (socket.connected) {
      socket.disconnect().connect();
    } else {
      socket.connect();
    }
  } else {
    localStorage.removeItem('syncplay_token');
    socket.auth = { token: null };
    if (socket.connected) {
      socket.disconnect();
    }
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
