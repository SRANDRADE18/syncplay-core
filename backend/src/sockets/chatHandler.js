const crypto = require('crypto');
const { roomsState } = require('./roomState');
const { getUserColor, getInitials } = require('../utils/avatar');

function registerChatHandlers(io, socket) {
  // 1. Envio de Mensagem no Chat
  socket.on('send_chat_message', (data) => {
    const { roomId, text, user, replyTo } = data || {};
    if (!roomId || !text || !text.trim()) return;

    const sender = roomsState[roomId]?.participants?.[socket.id];
    const authorName =
      sender?.name ||
      user?.name ||
      socket.user?.name ||
      (socket.user?.email ? socket.user.email.split('@')[0] : 'Usuário');
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
        isHost,
      },
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      reactions: [],
      replyTo: replyTo || null,
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

  // 2. Reações de Mensagem (Toggle estilo Discord)
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

  // 3. Exclusão de Mensagem
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

  // 4. Indicador de Digitação ("Fulano está digitando...")
  socket.on('user_typing', (data) => {
    const { roomId, isTyping } = data || {};
    if (!roomId) return;
    const sender = roomsState[roomId]?.participants?.[socket.id];
    const name = sender?.name || socket.user?.name || 'Alguém';
    socket.to(roomId).emit('user_typing_update', {
      userId: socket.user?.id || socket.id,
      name,
      isTyping: !!isTyping,
    });
  });
}

module.exports = {
  registerChatHandlers,
};

