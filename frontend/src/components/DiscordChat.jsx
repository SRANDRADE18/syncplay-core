import React, { useState, useEffect, useRef, useCallback } from 'react';
import { socket } from '../services/socket';
import { 
  Hash, Smile, Send, Plus, X, Trash2, Crown, Users, 
  CornerDownRight, Film, Bell, BellOff
} from 'lucide-react';

const QUICK_REACTIONS = ['🍿', '❤️', '🔥', '😂', '🚀', '👏'];

const EMOJI_CATEGORIES = {
  'Em Alta': ['🍿', '🎬', '🔥', '❤️', '😂', '🚀', '👏', '👀', '✨', '🎉'],
  'Reações & Emoções': ['😍', '🤣', '😭', '😱', '🥺', '🤯', '😎', '🥳', '😴', '🤔', '🙄', '👍', '👎', '💯'],
  'Cinema & Lanches': ['🥤', '🍕', '🍫', '🍔', '🛋️', '📺', '🎧', '⚡', '🏆', '⭐']
};

const QUICK_GIFS = [
  { label: '🍿 Comendo Pipoca', tag: '🍿 *comendo pipoca ansiosamente*' },
  { label: '😱 Choque Total', tag: '😱 *chocado com essa cena!*' },
  { label: '🔥 Que Cena!', tag: '🔥 *que cena absurda!*' },
  { label: '👏 Palmas', tag: '👏 *aplausos de pé*' },
  { label: '😭 Chorei', tag: '😭 *não estava preparado pra isso*' }
];

export function DiscordChat({ 
  roomId, 
  roomTitle = 'Sessão SyncPlay', 
  currentUser, 
  isHost,
  onOpenInvite
}) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [replyingTo, setReplyingTo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifMenu, setShowGifMenu] = useState(false);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' | 'members'
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [onlineParticipants, setOnlineParticipants] = useState([]);
  const [typingUsers, setTypingUsers] = useState({}); // { [userId]: userName }
  const [hoveredMessageId, setHoveredMessageId] = useState(null);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const audioContextRef = useRef(null);

  // Play Discord-style subtle notification blip
  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch {
      // Audio not permitted or suspended by browser
    }
  }, [soundEnabled]);

  // Socket event listeners for chat
  useEffect(() => {
    // 1. Receber histórico de chat da sala
    const handleChatHistory = (history) => {
      if (Array.isArray(history) && history.length > 0) {
        setMessages(history);
      }
    };

    // 2. Nova mensagem recebida
    const handleNewMessage = (msg) => {
      setMessages((prev) => {
        // Evita duplicatas se o ID já existir
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });

      // Som se não for minha própria mensagem
      const isMyMsg = msg.user?.id === currentUser?.id;
      if (!isMyMsg && !msg.isSystem) {
        playNotificationSound();
      }
    };

    // 3. Atualização de reações
    const handleReactionUpdate = (data) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id === data.messageId) {
            if (data.reactions) {
              return { ...m, reactions: data.reactions };
            }
            // Fallback manual toggle
            const existing = m.reactions || [];
            const rIdx = existing.findIndex((r) => r.emoji === data.emoji);
            if (rIdx === -1) {
              return {
                ...m,
                reactions: [...existing, { emoji: data.emoji, count: 1, users: [data.userId] }]
              };
            }
            return m;
          }
          return m;
        })
      );
    };

    // 4. Mensagem excluída
    const handleMessageDeleted = (data) => {
      setMessages((prev) => prev.filter((m) => m.id !== data.messageId));
    };

    // 5. Atualização de participantes online
    const handleParticipantsUpdate = (data) => {
      if (data?.participants) {
        setOnlineParticipants(data.participants);
      }
    };

    // 6. Indicador de digitação
    const handleTypingUpdate = (data) => {
      if (!data.userId || data.userId === currentUser?.id) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (data.isTyping) {
          next[data.userId] = data.name;
        } else {
          delete next[data.userId];
        }
        return next;
      });
    };

    socket.on('chat_history', handleChatHistory);
    socket.on('new_chat_message', handleNewMessage);
    socket.on('chat_reaction_update', handleReactionUpdate);
    socket.on('chat_message_deleted', handleMessageDeleted);
    socket.on('room_participants_update', handleParticipantsUpdate);
    socket.on('user_typing_update', handleTypingUpdate);

    return () => {
      socket.off('chat_history', handleChatHistory);
      socket.off('new_chat_message', handleNewMessage);
      socket.off('chat_reaction_update', handleReactionUpdate);
      socket.off('chat_message_deleted', handleMessageDeleted);
      socket.off('room_participants_update', handleParticipantsUpdate);
      socket.off('user_typing_update', handleTypingUpdate);
    };
  }, [currentUser?.id, playNotificationSound]);

  // Scroll suave para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers]);

  // Emite evento de digitação com debounce
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInputText(val);

    socket.emit('user_typing', { roomId, isTyping: val.length > 0 });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('user_typing', { roomId, isTyping: false });
    }, 2500);
  };

  // Enviar mensagem
  const handleSendMessage = (e) => {
    if (e) e.preventDefault();
    const clean = inputText.trim();
    if (!clean) return;

    const payload = {
      roomId,
      text: clean,
      user: {
        id: currentUser?.id,
        name: currentUser?.name || 'Usuário',
        initials: currentUser?.initials || (currentUser?.name ? currentUser.name.substring(0, 2).toUpperCase() : 'U'),
        color: currentUser?.color
      },
      replyTo: replyingTo
        ? {
            id: replyingTo.id,
            authorName: replyingTo.user?.name || 'Usuário',
            text: replyingTo.text
          }
        : null
    };

    socket.emit('send_chat_message', payload);
    socket.emit('user_typing', { roomId, isTyping: false });

    setInputText('');
    setReplyingTo(null);
    setShowEmojiPicker(false);
    setShowGifMenu(false);
    inputRef.current?.focus();
  };

  // Toggle de reação
  const handleToggleReaction = (messageId, emoji) => {
    socket.emit('chat_reaction', { roomId, messageId, emoji });
  };

  // Excluir mensagem
  const handleDeleteMessage = (messageId) => {
    if (confirm('Deseja excluir esta mensagem?')) {
      socket.emit('delete_chat_message', { roomId, messageId });
    }
  };

  // Formatar texto com markdown básico e menções estilo Discord
  const renderMessageContent = (text) => {
    if (!text) return null;

    // Detecta menções @Nome e aplica estilo Discord blurple
    const words = text.split(' ');
    return words.map((word, index) => {
      if (word.startsWith('@') && word.length > 1) {
        return (
          <span
            key={index}
            className="bg-[#5865F2]/25 text-[#93c5fd] hover:bg-[#5865F2]/40 font-medium px-1 py-0.5 rounded transition-colors cursor-pointer mr-1"
          >
            {word}
          </span>
        );
      }
      return word + ' ';
    });
  };

  // Lista de digitando
  const typingNames = Object.values(typingUsers);
  const typingText =
    typingNames.length === 1
      ? `${typingNames[0]} está digitando...`
      : typingNames.length === 2
      ? `${typingNames[0]} e ${typingNames[1]} estão digitando...`
      : typingNames.length > 2
      ? 'Várias pessoas estão digitando...'
      : null;

  return (
    <div className="flex flex-col h-full bg-[#0d101a] border-t lg:border-t-0 lg:border-l border-[#1a1e30] w-full lg:w-96 shrink-0 select-none relative">
      
      {/* 1. Discord Channel Header */}
      <div className="h-14 border-b border-[#1a1e30] px-4 flex items-center justify-between bg-[#0e111d] shrink-0">
        <div className="flex items-center space-x-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-[#181c2f] flex items-center justify-center text-[#80848e]">
            <Hash className="w-4 h-4 text-[#c084fc]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-white flex items-center space-x-1.5 truncate">
              <span>chat-da-sala</span>
            </h3>
            <p className="text-[10px] text-[#64748b] truncate hidden sm:block">
              Canal de texto oficial da sessão
            </p>
          </div>
        </div>

        {/* Header Actions: Toggle Members / Sound / Chat */}
        <div className="flex items-center space-x-1">
          {/* Sound Notification Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              soundEnabled ? 'text-[#a855f7] hover:bg-[#181c2f]' : 'text-[#64748b] hover:bg-[#181c2f]'
            }`}
            title={soundEnabled ? 'Sons ativados' : 'Sons mutados'}
          >
            {soundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
          </button>

          {/* Members Toggle */}
          <button
            onClick={() => setActiveTab(activeTab === 'chat' ? 'members' : 'chat')}
            className={`p-2 rounded-lg transition-colors flex items-center space-x-1 cursor-pointer ${
              activeTab === 'members'
                ? 'bg-[#232942] text-white'
                : 'text-[#94a3b8] hover:text-white hover:bg-[#181c2f]'
            }`}
            title="Ver participantes online"
          >
            <Users className="w-4 h-4" />
            <span className="text-[11px] font-bold text-emerald-400">
              {onlineParticipants.length || 1}
            </span>
          </button>
        </div>
      </div>

      {/* 2. Main Content Area: Chat or Members List */}
      {activeTab === 'members' ? (
        /* Members View */
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-[#1a1e30]">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8]">
              Participantes Online ({onlineParticipants.length || 1})
            </span>
            <button
              onClick={() => setActiveTab('chat')}
              className="text-xs text-[#a855f7] hover:underline cursor-pointer"
            >
              Voltar ao chat
            </button>
          </div>

          {/* Host Section */}
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400/90 block">
              Anfitrião — 1
            </span>
            {onlineParticipants
              .filter((p) => p.isHost)
              .map((p) => (
                <div
                  key={p.socketId || p.id}
                  className="flex items-center space-x-3 p-2.5 rounded-xl bg-[#131728] border border-[#232a45]"
                >
                  <div className="relative">
                    <div
                      className={`w-9 h-9 rounded-full ${
                        p.color || 'bg-gradient-to-tr from-[#6366f1] to-[#a855f7]'
                      } flex items-center justify-center text-xs font-bold text-white shadow`}
                    >
                      {p.initials || 'LM'}
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full ring-2 ring-[#0d101a]"></span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-1.5">
                      <h4 className="text-xs font-bold text-white truncate">{p.name}</h4>
                      <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                    </div>
                    <span className="text-[10px] text-amber-300 font-medium">Controlador da sala</span>
                  </div>
                </div>
              ))}
          </div>

          {/* Spectators Section */}
          <div className="space-y-2 pt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8] block">
              Espectadores — {onlineParticipants.filter((p) => !p.isHost).length}
            </span>
            {onlineParticipants.filter((p) => !p.isHost).length === 0 ? (
              <p className="text-xs text-[#64748b] py-2 italic">
                Nenhum outro espectador conectado. Convide amigos com o link da sala!
              </p>
            ) : (
              onlineParticipants
                .filter((p) => !p.isHost)
                .map((p) => (
                  <div
                    key={p.socketId || p.id}
                    className="flex items-center space-x-3 p-2.5 rounded-xl bg-[#111422] border border-[#1b2034] hover:bg-[#15192b] transition-colors"
                  >
                    <div className="relative">
                      <div
                        className={`w-8 h-8 rounded-full ${
                          p.color || 'bg-gradient-to-tr from-[#5865F2] to-[#7983F5]'
                        } flex items-center justify-center text-[11px] font-bold text-white shadow`}
                      >
                        {p.initials || 'US'}
                      </div>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-[#0d101a]"></span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-semibold text-white truncate">{p.name}</h4>
                      <span className="text-[10px] text-emerald-400">Sincronizado</span>
                    </div>
                  </div>
                ))
            )}
          </div>

          {/* Quick Invite Button */}
          {onOpenInvite && (
            <div className="pt-4">
              <button
                onClick={onOpenInvite}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[#7c3aed] to-[#6366f1] hover:from-[#6d28d9] hover:to-[#4f46e5] flex items-center justify-center space-x-2 transition-all cursor-pointer shadow-md"
              >
                <Users className="w-4 h-4" />
                <span>Convidar Amigos</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Chat Messages Feed */
        <div className="flex-1 p-3 md:p-4 overflow-y-auto space-y-2">
          
          {/* Discord Channel Welcome Header */}
          <div className="pt-2 pb-4 space-y-2 border-b border-[#1a1e30]/80">
            <div className="w-12 h-12 rounded-full bg-[#1e2338] flex items-center justify-center text-white shadow-inner">
              <Hash className="w-6 h-6 text-[#c084fc]" />
            </div>
            <h3 className="text-xl font-extrabold text-white">
              Bem-vindo(a) ao #{'chat-da-sala'}!
            </h3>
            <p className="text-xs text-[#94a3b8] leading-relaxed">
              Este é o início do canal de texto para a sessão{' '}
              <strong className="text-white font-medium">"{roomTitle}"</strong>. Comente as cenas,
              interaja e reaja com a galera em tempo real!
            </p>
            <div className="flex items-center space-x-2 text-[10px] text-[#64748b] pt-1">
              <span>💬 Mensagens sincronizadas</span>
              <span>•</span>
              <span>⚡ Sem delay</span>
            </div>
          </div>

          {/* Messages Mapping with Discord-Style Grouping */}
          {messages.map((msg, index) => {
            // Se for mensagem de sistema (join, leave, video action)
            if (msg.isSystem) {
              return (
                <div key={msg.id || index} className="flex items-center space-x-2 py-1 px-2 text-xs">
                  <span className="text-emerald-400 font-bold">→</span>
                  <span className="text-[#94a3b8] text-[11px] leading-relaxed">
                    {msg.text}
                  </span>
                  <span className="text-[10px] text-[#475569]">{msg.time}</span>
                </div>
              );
            }

            // Agrupamento Discord: Checa se a mensagem anterior foi do mesmo autor em menos de 5 min
            const prevMsg = messages[index - 1];
            const isSameUserAsPrev =
              prevMsg &&
              !prevMsg.isSystem &&
              prevMsg.user?.id === msg.user?.id &&
              prevMsg.user?.name === msg.user?.name;

            const isMyMessage = msg.user?.id === currentUser?.id;
            const isHovered = hoveredMessageId === msg.id;

            return (
              <div
                key={msg.id || index}
                onMouseEnter={() => setHoveredMessageId(msg.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
                className={`group relative rounded-xl px-2 py-1 transition-colors ${
                  isHovered ? 'bg-[#15192b]/70' : 'hover:bg-[#131626]/40'
                } ${isSameUserAsPrev ? 'mt-0.5' : 'mt-2'}`}
              >
                {/* Floating Discord Action Bar on Hover */}
                {isHovered && (
                  <div className="absolute right-2 -top-3.5 z-10 bg-[#1e2338] border border-[#2b3352] rounded-lg shadow-xl px-1.5 py-0.5 flex items-center space-x-1 animate-in fade-in zoom-in-95 duration-150">
                    {QUICK_REACTIONS.slice(0, 4).map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleToggleReaction(msg.id, emoji)}
                        className="p-1 hover:bg-[#2b3352] rounded text-xs transition-transform active:scale-125 cursor-pointer"
                        title={`Reagir com ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                    <span className="w-px h-3 bg-[#333b5c]"></span>
                    <button
                      onClick={() => {
                        setReplyingTo(msg);
                        inputRef.current?.focus();
                      }}
                      className="p-1 text-[#94a3b8] hover:text-white hover:bg-[#2b3352] rounded text-xs transition-colors cursor-pointer"
                      title="Responder mensagem"
                    >
                      <CornerDownRight className="w-3.5 h-3.5" />
                    </button>
                    {(isMyMessage || isHost) && (
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="p-1 text-[#94a3b8] hover:text-rose-400 hover:bg-[#2b3352] rounded text-xs transition-colors cursor-pointer"
                        title="Excluir mensagem"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Reply Citation Header if replying */}
                {msg.replyTo && (
                  <div className="flex items-center space-x-1.5 text-[11px] text-[#64748b] ml-11 mb-1 truncate">
                    <CornerDownRight className="w-3 h-3 text-[#a855f7] shrink-0" />
                    <span className="text-[#a855f7] font-semibold">@{msg.replyTo.authorName}</span>
                    <span className="truncate italic text-[#94a3b8]">"{msg.replyTo.text}"</span>
                  </div>
                )}

                {/* Message Row */}
                <div className="flex items-start space-x-3">
                  {!isSameUserAsPrev ? (
                    /* Full Header + Avatar */
                    <>
                      <div
                        className={`w-9 h-9 rounded-full ${
                          msg.user?.color || 'bg-gradient-to-tr from-[#5865F2] to-[#7983F5]'
                        } flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5 shadow-md`}
                      >
                        {msg.user?.initials || 'U'}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Author Header */}
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-white hover:underline cursor-pointer">
                            {msg.user?.name || 'Usuário'}
                          </span>

                          {msg.user?.isHost && (
                            <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[9px] font-extrabold uppercase">
                              <Crown className="w-2.5 h-2.5 mr-0.5" />
                              Host
                            </span>
                          )}

                          {isMyMessage && (
                            <span className="px-1 py-0.2 rounded bg-[#5865F2]/20 text-[#a5b4fc] text-[9px] font-bold">
                              Você
                            </span>
                          )}

                          <span className="text-[10px] text-[#64748b]">{msg.time}</span>
                        </div>

                        {/* Message Text */}
                        <div className="text-xs text-[#e2e8f0] leading-relaxed break-words mt-0.5">
                          {renderMessageContent(msg.text)}
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Compact Consecutive Message (Same author) */
                    <div className="flex items-start space-x-3 w-full">
                      <div className="w-9 shrink-0 text-center">
                        <span className="opacity-0 group-hover:opacity-100 text-[9px] text-[#64748b] transition-opacity">
                          {msg.time}
                        </span>
                      </div>
                      <div className="flex-1 text-xs text-[#e2e8f0] leading-relaxed break-words">
                        {renderMessageContent(msg.text)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Reactions Pill Badges */}
                {msg.reactions && msg.reactions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 ml-12 mt-1.5">
                    {msg.reactions.map((r, i) => {
                      const userReacted = r.users?.includes(currentUser?.id);
                      return (
                        <button
                          key={i}
                          onClick={() => handleToggleReaction(msg.id, r.emoji)}
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                            userReacted
                              ? 'bg-[#3c4270]/60 border-[#5865F2] text-[#93c5fd]'
                              : 'bg-[#181c2f] hover:bg-[#232942] border-[#262c47] text-[#94a3b8]'
                          }`}
                          title={`Reações: ${r.count}`}
                        >
                          <span>{r.emoji}</span>
                          <span className="text-[10px]">{r.count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>
      )}

      {/* 3. Real-time Typing Indicator */}
      {typingText && (
        <div className="px-4 py-1 text-[11px] text-[#a855f7] flex items-center space-x-1.5 animate-pulse bg-[#0d101a]/90">
          <span className="inline-block w-1.5 h-1.5 bg-[#a855f7] rounded-full animate-bounce"></span>
          <span className="inline-block w-1.5 h-1.5 bg-[#a855f7] rounded-full animate-bounce [animation-delay:0.2s]"></span>
          <span className="inline-block w-1.5 h-1.5 bg-[#a855f7] rounded-full animate-bounce [animation-delay:0.4s]"></span>
          <span className="italic">{typingText}</span>
        </div>
      )}

      {/* 4. Reply Notification Banner */}
      {replyingTo && (
        <div className="px-4 py-1.5 bg-[#171b2d] border-t border-[#232942] flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 truncate">
            <CornerDownRight className="w-3.5 h-3.5 text-[#a855f7] shrink-0" />
            <span className="text-[#94a3b8]">
              Respondendo a <strong className="text-white">@{replyingTo.user?.name}</strong>
            </span>
            <span className="text-[#64748b] truncate italic">"{replyingTo.text}"</span>
          </div>
          <button
            onClick={() => setReplyingTo(null)}
            className="p-1 text-[#64748b] hover:text-white rounded transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 5. Popups: Emoji Picker & GIF Menu */}
      {showEmojiPicker && (
        <div className="absolute bottom-16 left-3 right-3 bg-[#131626] border border-[#232942] rounded-2xl p-3 shadow-2xl z-30 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-[#1f243a] mb-2">
            <span className="text-xs font-bold text-white flex items-center space-x-1">
              <Smile className="w-3.5 h-3.5 text-[#a855f7]" />
              <span>Emojis</span>
            </span>
            <button
              onClick={() => setShowEmojiPicker(false)}
              className="text-[#64748b] hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
            {Object.entries(EMOJI_CATEGORIES).map(([cat, emojis]) => (
              <div key={cat}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] block mb-1">
                  {cat}
                </span>
                <div className="grid grid-cols-7 gap-1">
                  {emojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => {
                        setInputText((prev) => prev + emoji);
                        setShowEmojiPicker(false);
                        inputRef.current?.focus();
                      }}
                      className="p-1.5 hover:bg-[#232942] rounded-lg text-lg text-center transition-transform hover:scale-125 cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showGifMenu && (
        <div className="absolute bottom-16 left-3 right-3 bg-[#131626] border border-[#232942] rounded-2xl p-3 shadow-2xl z-30 animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-[#1f243a] mb-2">
            <span className="text-xs font-bold text-white flex items-center space-x-1">
              <Film className="w-3.5 h-3.5 text-[#a855f7]" />
              <span>Reações Rápidas & Cinema</span>
            </span>
            <button onClick={() => setShowGifMenu(false)} className="text-[#64748b] hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-1.5">
            {QUICK_GIFS.map((g, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setInputText(g.tag);
                  setShowGifMenu(false);
                  inputRef.current?.focus();
                }}
                className="w-full text-left px-3 py-2 rounded-xl bg-[#181c2f] hover:bg-[#232942] text-xs font-medium text-white transition-colors cursor-pointer"
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 6. Discord Chat Input Bar */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 border-t border-[#1a1e30] bg-[#0c0e17] shrink-0"
      >
        <div className="relative flex items-center bg-[#131626] border border-[#232942] focus-within:border-[#5865F2] rounded-2xl px-2.5 py-1.5 transition-all shadow-inner">
          
          {/* Left: Quick Actions Button (+) */}
          <button
            type="button"
            onClick={() => {
              setShowGifMenu(!showGifMenu);
              setShowEmojiPicker(false);
            }}
            className="p-1.5 text-[#64748b] hover:text-white hover:bg-[#1f243a] rounded-xl transition-colors cursor-pointer"
            title="Ações e reações rápidas"
          >
            <Plus className="w-4 h-4" />
          </button>

          {/* Text Input */}
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={handleInputChange}
            placeholder={`Conversar em #${'chat-da-sala'}...`}
            className="flex-1 bg-transparent px-2.5 py-1.5 text-xs text-white placeholder-[#64748b] focus:outline-none"
          />

          {/* Right: Emoji Picker Button */}
          <button
            type="button"
            onClick={() => {
              setShowEmojiPicker(!showEmojiPicker);
              setShowGifMenu(false);
            }}
            className="p-1.5 text-[#64748b] hover:text-[#c084fc] hover:bg-[#1f243a] rounded-xl transition-colors cursor-pointer mr-1"
            title="Inserir emoji"
          >
            <Smile className="w-4 h-4" />
          </button>

          {/* Send Button */}
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-2 rounded-xl bg-gradient-to-r from-[#5865F2] to-[#7c3aed] text-white hover:brightness-110 disabled:opacity-25 transition-all cursor-pointer shadow-md"
            title="Enviar mensagem"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </form>

    </div>
  );
}
