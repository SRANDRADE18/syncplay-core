import React, { useState, useEffect, useRef, useCallback } from 'react';
import _ReactPlayer from 'react-player';
const ReactPlayer = _ReactPlayer.default || _ReactPlayer;
import { socket, API_URL } from '../services/socket';
import { 
  ChevronLeft, Play, Pause, Volume2, VolumeX, Volume1, Maximize, Minimize,
  UserPlus, Sparkles, Crown, Eye, Link2, Check, Sliders, MessageSquare, Users, Info
} from 'lucide-react';
import { InviteModal } from './InviteModal';
import { DiscordChat } from './DiscordChat';

export function Room({ 
  roomId, 
  roomTitle = 'Sessão SyncPlay', 
  defaultVideoTitle = 'Vídeo Sincronizado', 
  initialVideoUrl, 
  onLeave, 
  user,
  initialIsHost = false
}) {
  const [isHost, setIsHost] = useState(() => {
    if (initialIsHost) return true;
    return Boolean(
      sessionStorage.getItem(`hostToken_${roomId}`) ||
      localStorage.getItem(`syncplay_host_${roomId}`)
    );
  });
  const [resolvedTitle, setResolvedTitle] = useState(roomTitle);
  const [errorMsg, setErrorMsg] = useState('');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  
  // Mobile Room Tab ('chat' | 'members' | 'info') e sub-aba do painel lateral no desktop
  const [mobileRoomTab, setMobileRoomTab] = useState('chat');
  const [chatPanelTab, setChatPanelTab] = useState('chat');
  const [unreadCount, setUnreadCount] = useState(0);
  const lastSeenMsgCountRef = useRef(0);

  // Player states
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [volume, setVolume] = useState(0.85);
  const [muted, setMuted] = useState(false);
  const [playedSeconds, setPlayedSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [useNativeControls, setUseNativeControls] = useState(false);
  const [isHoveringPlayer, setIsHoveringPlayer] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [isPseudoFullscreen, setIsPseudoFullscreen] = useState(false);

  const [videoUrl, setVideoUrl] = useState(() => {
    if (initialVideoUrl && initialVideoUrl.trim()) {
      return initialVideoUrl.trim().replace(/^http:\/\//i, 'https://');
    }
    const token = localStorage.getItem('syncplay_token');
    if (!token || token === 'demo_token') {
      return 'https://www.youtube.com/watch?v=jfKfPfyJRdk';
    }
    return '';
  });

  // URL edit input for host
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [newUrlInput, setNewUrlInput] = useState('');
  const [urlCopied, setUrlCopied] = useState(false);

  const [participants, setParticipants] = useState([]);
  const [polledMessages, setPolledMessages] = useState([]);
  const playerRef = useRef(null);
  const playerContainerRef = useRef(null);
  const overlayTimerRef = useRef(null);

  // Helper para formatar segundos em HH:MM:SS ou MM:SS
  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '00:00';
    const totalSecs = Math.floor(secs);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    const pad = (n) => n.toString().padStart(2, '0');
    if (h > 0) {
      return `${h}:${pad(m)}:${pad(s)}`;
    }
    return `${pad(m)}:${pad(s)}`;
  };

  // Helper para enviar sincronização via REST (garante funcionamento na Vercel e celular)
  const postSyncState = useCallback((payload) => {
    const token = localStorage.getItem('syncplay_token');
    if (!token || token === 'demo_token') return;
    fetch(`${API_URL}/rooms/${roomId}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }).catch(() => {});
  }, [roomId]);

  const handleSelectMobileTab = (tab) => {
    setMobileRoomTab(tab);
    if (tab === 'chat' || tab === 'members') {
      setChatPanelTab(tab);
    }
    if (tab === 'chat') {
      lastSeenMsgCountRef.current = polledMessages.length;
      setUnreadCount(0);
    }
  };

  // Hidratação inicial e Polling REST inteligente (sincroniza dispositivos na Vercel/celular)
  useEffect(() => {
    const token = localStorage.getItem('syncplay_token');
    if (!token || token === 'demo_token') {
      return;
    }

    let cancelled = false;

    const fetchRoomState = async (isInitial = false) => {
      try {
        const res = await fetch(`${API_URL}/rooms/${roomId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          if (isInitial) {
            setVideoUrl((prev) => prev || 'https://www.youtube.com/watch?v=jfKfPfyJRdk');
          }
          return;
        }
        const data = await res.json();
        if (cancelled) return;

        if (data.title) setResolvedTitle(data.title);
        if (typeof data.isHost === 'boolean') {
          setIsHost(data.isHost);
        }
        if (data.video_url && data.video_url.trim()) {
          const cleanRemoteUrl = data.video_url.trim().replace(/^http:\/\//i, 'https://');
          setVideoUrl((prev) => (prev !== cleanRemoteUrl ? cleanRemoteUrl : prev));
        }
        if (Array.isArray(data.participants)) {
          setParticipants(data.participants);
        }
        if (Array.isArray(data.messages)) {
          setPolledMessages(data.messages);
          if (mobileRoomTab !== 'chat' && data.messages.length > lastSeenMsgCountRef.current) {
            setUnreadCount(data.messages.length - lastSeenMsgCountRef.current);
          } else if (mobileRoomTab === 'chat') {
            lastSeenMsgCountRef.current = data.messages.length;
            setUnreadCount(0);
          }
        }

        // Sincroniza player se este cliente for espectador (ou na carga inicial)
        if (!data.isHost || isInitial) {
          if (typeof data.playbackRate === 'number' && data.playbackRate > 0) {
            setPlaybackRate(data.playbackRate);
          }
          const player = playerRef.current;
          if (player && typeof player.getCurrentTime === 'function' && typeof data.timestamp === 'number') {
            const localTime = player.getCurrentTime() || 0;
            const drift = Math.abs(localTime - data.timestamp);
            if (drift > 2.2) {
              player.seekTo(data.timestamp, 'seconds');
            }
          }
          if (!data.isHost && typeof data.isPlaying === 'boolean') {
            setPlaying((prev) => (prev !== data.isPlaying ? data.isPlaying : prev));
          }
        }
      } catch {
        if (isInitial) {
          setVideoUrl((prev) => prev || 'https://www.youtube.com/watch?v=jfKfPfyJRdk');
        }
      }
    };

    fetchRoomState(true);
    const pollInterval = setInterval(() => {
      if (!socket.connected) {
        fetchRoomState(false);
      }
    }, 2500);

    return () => {
      cancelled = true;
      clearInterval(pollInterval);
    };
  }, [roomId, mobileRoomTab]);

  // Sincronização do Ingressante via Socket.io (quando conectado)
  useEffect(() => {
    if (socket.connected) {
      socket.emit('request_initial_state', { roomId });
    }

    const handleInitialState = (data) => {
      if (data.videoUrl && data.videoUrl.trim()) {
        setVideoUrl(data.videoUrl.trim().replace(/^http:\/\//i, 'https://'));
      }

      if (isHost) return;
      const player = playerRef.current;
      if (!player || typeof player.getCurrentTime !== 'function') return;

      const localTime = player.getCurrentTime();
      const drift = Math.abs(localTime - data.timestamp);

      if (drift > 1.5) {
        player.seekTo(data.timestamp, 'seconds');
      }

      setPlaying(data.isPlaying);
    };

    socket.on('initial_state_response', handleInitialState);

    return () => {
      socket.off('initial_state_response', handleInitialState);
    };
  }, [roomId, isHost]);

  // Gestão de papéis e sincronização de comandos via Socket.io
  useEffect(() => {
    const savedToken =
      sessionStorage.getItem(`hostToken_${roomId}`) ||
      localStorage.getItem(`syncplay_host_${roomId}`);

    if (socket.connected) {
      socket.emit('join_room', { 
        roomId, 
        hostToken: savedToken,
        user: {
          id: user?.id,
          name: user?.name,
          initials: user?.initials,
          email: user?.email
        }
      });
    }

    const handleRoleAssigned = (data) => {
      setIsHost(data.isHost);
      if (data.isHost && data.hostToken) {
        sessionStorage.setItem(`hostToken_${roomId}`, data.hostToken);
        localStorage.setItem(`syncplay_host_${roomId}`, data.hostToken);
      }
      if (data.videoUrl && data.videoUrl.trim()) {
        setVideoUrl(data.videoUrl.trim().replace(/^http:\/\//i, 'https://'));
      }
      if (data.roomName) {
        setResolvedTitle(data.roomName);
      }
    };
    socket.on('role_assigned', handleRoleAssigned);

    const handleCreationRejected = (data) => setErrorMsg(data.message);
    const handleJoinRejected = (data) => setErrorMsg(data.message);
    const handleHostTimeoutKick = () => {
      sessionStorage.removeItem(`hostToken_${roomId}`);
      setErrorMsg('A sala foi encerrada pelo servidor porque o Anfitrião perdeu a conexão.');
    };

    socket.on('creation_rejected', handleCreationRejected);
    socket.on('join_rejected', handleJoinRejected);
    socket.on('host_timeout_kick', handleHostTimeoutKick);

    const handleSyncCommand = (data) => {
      if (isHost) return;
      const player = playerRef.current;
      if (!player || typeof player.getCurrentTime !== 'function') return;

      if (data.timestamp !== undefined) {
        const localTime = player.getCurrentTime();
        const drift = Math.abs(localTime - data.timestamp);
        if (drift > 1.5) {
          player.seekTo(data.timestamp, 'seconds');
        }
      }

      if (data.action === 'play') setPlaying(true);
      else if (data.action === 'pause') setPlaying(false);
      else if (data.action === 'buffer') setPlaying(false);
    };

    socket.on('sync_command', handleSyncCommand);

    const handleVideoUrlChanged = (data) => {
      if (data.videoUrl) {
        setVideoUrl(data.videoUrl.trim().replace(/^http:\/\//i, 'https://'));
        setPlaying(false);
        setPlayedSeconds(0);
      }
    };
    socket.on('video_url_changed', handleVideoUrlChanged);

    const handleParticipantsUpdate = (data) => {
      if (data?.participants) {
        setParticipants(data.participants);
      }
    };
    socket.on('room_participants_update', handleParticipantsUpdate);

    const handleSyncHeartbeat = (data) => {
      if (isHost) return;
      const player = playerRef.current;
      if (!player || typeof player.getCurrentTime !== 'function') return;

      if (data.timestamp !== undefined) {
        const localTime = player.getCurrentTime();
        const drift = Math.abs(localTime - data.timestamp);
        if (drift > 1.5) {
          player.seekTo(data.timestamp, 'seconds');
        }
      }

      if (typeof data.isPlaying === 'boolean') {
        setPlaying((prev) => (prev !== data.isPlaying ? data.isPlaying : prev));
      }
    };
    socket.on('sync_heartbeat', handleSyncHeartbeat);

    return () => {
      socket.off('role_assigned', handleRoleAssigned);
      socket.off('creation_rejected', handleCreationRejected);
      socket.off('join_rejected', handleJoinRejected);
      socket.off('host_timeout_kick', handleHostTimeoutKick);
      socket.off('sync_command', handleSyncCommand);
      socket.off('video_url_changed', handleVideoUrlChanged);
      socket.off('room_participants_update', handleParticipantsUpdate);
      socket.off('sync_heartbeat', handleSyncHeartbeat);
    };
  }, [roomId, isHost, user]);

  // Emissão periódica de Heartbeat pelo anfitrião (a cada 5 segundos via Socket + REST)
  useEffect(() => {
    if (!isHost || !playing) return;

    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player || typeof player.getCurrentTime !== 'function') return;
      const currentTime = player.getCurrentTime();

      if (socket.connected) {
        socket.emit('video_heartbeat', {
          roomId,
          timestamp: currentTime,
          isPlaying: true,
        });
      }
      postSyncState({
        action: 'play',
        isPlaying: true,
        timestamp: currentTime,
        playbackRate,
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [isHost, playing, roomId, playbackRate, postSyncState]);

  // Handler para emitir eventos apenas se for o host
  const emitVideoCommand = (action, customTimestamp) => {
    if (!isHost) return;
    const player = playerRef.current;
    const ts =
      customTimestamp !== undefined
        ? customTimestamp
        : (player && typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : playedSeconds);

    if (socket.connected) {
      socket.emit('video_command', {
        roomId,
        action,
        timestamp: ts
      });
    }
    postSyncState({
      action,
      isPlaying: action === 'play',
      timestamp: ts,
      playbackRate,
    });
  };

  const handlePlay = () => {
    setPlaying(true);
    emitVideoCommand('play');
  };

  const handlePause = () => {
    setPlaying(false);
    emitVideoCommand('pause');
  };

  const handleBuffer = () => {
    emitVideoCommand('buffer');
  };

  const handlePlayerError = (error) => {
    console.warn('[SyncPlay Player Warning]', error);
    if (!isHost) {
      setAutoplayBlocked(true);
    }
  };

  const handleDismissAutoplay = () => {
    setAutoplayBlocked(false);
    setPlaying(true);
    const player = playerRef.current;
    if (player && typeof player.getInternalPlayer === 'function') {
      try {
        const internal = player.getInternalPlayer();
        if (internal && typeof internal.playVideo === 'function') internal.playVideo();
        else if (internal && typeof internal.play === 'function') internal.play();
      } catch (e) {
        console.warn('Erro ao forçar play:', e);
      }
    }
  };

  const handleTogglePlay = (e) => {
    if (e) e.stopPropagation();
    if (!isHost) {
      alert('Apenas o anfitrião pode controlar a reprodução do vídeo para a sala.');
      return;
    }
    const nextState = !playing;
    setPlaying(nextState);
    emitVideoCommand(nextState ? 'play' : 'pause');
  };

  // Toque na área do vídeo no celular exibe/oculta controles sobrepostos suavemente
  const handlePlayerTap = () => {
    setIsHoveringPlayer((prev) => {
      const next = !prev;
      if (overlayTimerRef.current) clearTimeout(overlayTimerRef.current);
      if (next && playing) {
        overlayTimerRef.current = setTimeout(() => setIsHoveringPlayer(false), 3200);
      }
      return next;
    });
  };

  // Timeline seeking
  const handleSeekChange = (e) => {
    const newSecs = parseFloat(e.target.value);
    setPlayedSeconds(newSecs);
  };

  const handleSeekMouseDown = () => {
    setIsSeeking(true);
  };

  const handleSeekMouseUp = (e) => {
    setIsSeeking(false);
    const newSecs = parseFloat(e.target.value);
    if (playerRef.current) {
      playerRef.current.seekTo(newSecs, 'seconds');
    }
    if (isHost) {
      emitVideoCommand(playing ? 'play' : 'pause', newSecs);
    }
  };

  // Volume & Mute local (funciona para host e espectadores!)
  const handleVolumeChange = (e) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    setMuted(newVol === 0);
  };

  const handleToggleMute = () => {
    if (muted) {
      setMuted(false);
      if (volume === 0) setVolume(0.5);
    } else {
      setMuted(true);
    }
  };

  // Tela Cheia compatível com Android, Desktop e iPhone (iOS Safari fallback)
  const toggleFullscreen = () => {
    if (isPseudoFullscreen) {
      setIsPseudoFullscreen(false);
      return;
    }
    const el = playerContainerRef.current;
    if (!el) return;

    if (document.fullscreenElement || document.webkitFullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      return;
    }

    if (el.requestFullscreen) {
      el.requestFullscreen().catch(() => setIsPseudoFullscreen(true));
    } else if (el.webkitRequestFullscreen) {
      el.webkitRequestFullscreen();
    } else {
      // Fallback imersivo para iPhone / iOS Safari (onde div.requestFullscreen não existe)
      setIsPseudoFullscreen(true);
    }
  };

  const handleChangeVideoUrl = (e) => {
    e.preventDefault();
    if (!newUrlInput.trim()) return;
    const clean = newUrlInput.trim().replace(/^http:\/\//i, 'https://');
    setVideoUrl(clean);
    setPlaying(false);
    setPlayedSeconds(0);
    if (socket.connected) {
      socket.emit('change_video_url', { roomId, videoUrl: clean });
    }
    postSyncState({
      action: 'pause',
      isPlaying: false,
      timestamp: 0,
      videoUrl: clean,
    });
    setShowUrlInput(false);
    setNewUrlInput('');
  };

  if (errorMsg) {
    return (
      <div className="p-6 sm:p-8 max-w-lg mx-4 sm:mx-auto bg-[#1a121d] border border-rose-500/40 rounded-3xl text-center space-y-4 my-12 shadow-2xl">
        <h3 className="text-xl font-bold text-rose-400">Acesso Negado</h3>
        <p className="text-xs text-[#94a3b8]">{errorMsg}</p>
        <button
          onClick={onLeave}
          className="px-6 py-2.5 rounded-xl bg-[#252a3f] hover:bg-[#343b59] text-white text-xs font-bold transition-colors cursor-pointer"
        >
          Voltar ao Início
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-[#0b0d14] select-none overflow-hidden animate-in fade-in duration-300">
      
      {/* Top Watch Room Header (Responsivo para Celular e Desktop) */}
      <header className="h-14 sm:h-16 border-b border-[#1a1e30] flex items-center justify-between px-3 sm:px-6 bg-[#0d101a] shrink-0 pt-safe gap-2">
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
          <button
            onClick={onLeave}
            className="p-2 -ml-1 rounded-xl text-[#94a3b8] hover:text-white hover:bg-[#151929] transition-colors cursor-pointer shrink-0"
            title="Voltar ao início"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
            <div className="hidden sm:flex w-8 h-8 rounded-xl bg-gradient-to-tr from-[#6366f1] to-[#a855f7] items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.5)] shrink-0">
              <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-white truncate">
                {resolvedTitle}
              </h2>
              <div className="flex items-center space-x-1.5 sm:space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399] shrink-0"></span>
                <span className="text-[10px] sm:text-[11px] font-medium text-emerald-400">Ao vivo</span>
                <span className="text-[10px] text-[#475569]">•</span>
                <span className="text-[10px] sm:text-[11px] font-semibold">
                  {isHost ? (
                    <span className="inline-flex items-center space-x-1 text-amber-300 font-bold">
                      <Crown className="w-3 h-3 text-amber-400" /> 
                      <span>Anfitrião</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 text-slate-300 font-medium">
                      <Eye className="w-3 h-3 text-slate-400" /> 
                      <span>Espectador</span>
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right CTA Buttons */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          {isHost && (
            <button
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-semibold text-[#a855f7] hover:text-white bg-[#171a2b] hover:bg-[#20253d] border border-[#262c47] flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Trocar URL do Vídeo"
            >
              <Link2 className="w-4 h-4" />
              <span className="hidden sm:inline">Trocar Vídeo</span>
            </button>
          )}

          <button
            onClick={() => setIsInviteOpen(true)}
            className="inline-flex items-center space-x-1.5 sm:space-x-2 px-3 sm:px-4 py-2 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-[#7c3aed] to-[#6366f1] sm:bg-none sm:bg-[#1b1f32] sm:hover:bg-[#252b47] border border-[#7c3aed]/40 sm:border-[#2b3252] shadow-sm transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-white sm:text-[#a855f7]" />
            <span>Convidar</span>
          </button>
        </div>
      </header>

      {/* Host URL Change Bar (if opened) */}
      {showUrlInput && isHost && (
        <form onSubmit={handleChangeVideoUrl} className="bg-[#141829] border-b border-[#202742] p-3 sm:p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 shrink-0 animate-in slide-in-from-top-2 duration-200">
          <div className="relative flex-1">
            <Link2 className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="url"
              required
              value={newUrlInput}
              onChange={(e) => setNewUrlInput(e.target.value)}
              placeholder="Cole novo link do YouTube, Vimeo ou MP4..."
              className="w-full bg-[#0d0f1a] border border-[#232942] rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-[#64748b] focus:outline-none focus:border-[#a855f7]"
            />
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="submit"
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6366f1] text-white font-bold text-xs hover:from-[#6d28d9] hover:to-[#4f46e5] transition-all cursor-pointer shadow-md"
            >
              Atualizar Vídeo
            </button>
            <button
              type="button"
              onClick={() => setShowUrlInput(false)}
              className="px-3 py-2.5 rounded-xl bg-[#1e2338] text-[#94a3b8] hover:text-white text-xs font-semibold"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Main Content: No celular = Player fixo no topo + Chat/Abas embaixo; No Desktop = Lado a Lado */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left / Top Side: Video Player Area */}
        <div
          className={`lg:flex-1 lg:p-6 lg:overflow-y-auto lg:space-y-4 ${
            mobileRoomTab === 'info' ? 'flex-1 overflow-y-auto' : 'shrink-0'
          }`}
        >
          
          {/* Active URL Info bar (visível no desktop; no celular aparece na aba Detalhes) */}
          <div className="hidden lg:flex items-center justify-between px-4 py-2 rounded-xl bg-[#111422] border border-[#1e2338] text-xs">
            <div className="flex items-center space-x-2 truncate">
              <span className="text-[#a855f7] font-semibold">URL Ativa:</span>
              <span className="text-[#94a3b8] font-mono truncate">{videoUrl || 'Carregando...'}</span>
            </div>
            <button
              onClick={() => {
                if (!videoUrl) return;
                navigator.clipboard.writeText(videoUrl);
                setUrlCopied(true);
                setTimeout(() => setUrlCopied(false), 2000);
              }}
              className="text-[#64748b] hover:text-white ml-2 shrink-0 cursor-pointer"
            >
              {urlCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : 'Copiar'}
            </button>
          </div>

          {/* Video Container Box (única instância de ReactPlayer para não duplicar áudio) */}
          <div 
            ref={playerContainerRef}
            onMouseEnter={() => setIsHoveringPlayer(true)}
            onMouseLeave={() => setIsHoveringPlayer(false)}
            onClick={handlePlayerTap}
            className={
              isPseudoFullscreen
                ? 'fixed inset-0 z-50 bg-black flex items-center justify-center'
                : 'relative w-full aspect-video bg-black lg:rounded-3xl overflow-hidden lg:border border-[#1e2338] shadow-[0_12px_40px_rgba(0,0,0,0.8)] flex items-center justify-center group'
            }
          >
            {videoUrl ? (
              <div className={`w-full h-full ${!isHost && useNativeControls ? 'pointer-events-none' : ''}`}>
                <ReactPlayer
                  ref={playerRef}
                  url={videoUrl.trim()}
                  playing={playing}
                  volume={muted ? 0 : volume}
                  muted={muted}
                  playbackRate={playbackRate}
                  playsinline={true}
                  controls={useNativeControls ? isHost : false}
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onBuffer={handleBuffer}
                  onError={handlePlayerError}
                  onProgress={(state) => {
                    if (!isSeeking) setPlayedSeconds(state.playedSeconds);
                  }}
                  onDuration={(d) => setDuration(d)}
                  width="100%"
                  height="100%"
                  config={{
                    youtube: {
                      playerVars: {
                        autoplay: 0,
                        controls: useNativeControls ? 1 : 0,
                        modestbranding: 1,
                        playsinline: 1,
                        rel: 0
                      }
                    },
                    file: {
                      attributes: {
                        playsInline: true,
                        'webkit-playsinline': 'true'
                      }
                    }
                  }}
                />
              </div>
            ) : (
              <div className="text-gray-400 animate-pulse text-xs sm:text-sm">Sincronizando vídeo da sala...</div>
            )}

            {/* Botão sair da tela cheia imersiva no iPhone */}
            {isPseudoFullscreen && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPseudoFullscreen(false);
                }}
                className="absolute top-4 right-4 z-50 px-3 py-2 rounded-xl bg-black/75 border border-white/20 text-white text-xs font-bold flex items-center space-x-1.5"
              >
                <Minimize className="w-4 h-4" />
                <span>Sair da Tela Cheia</span>
              </button>
            )}

            {/* Overlay Top Badge */}
            <div className={`absolute top-3 left-3 right-3 sm:top-4 sm:left-5 sm:right-5 flex justify-between items-center transition-opacity duration-300 pointer-events-none z-20 ${isHoveringPlayer || !playing ? 'opacity-100' : 'opacity-0'}`}>
              <div className="text-xs sm:text-sm font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] truncate pr-2">
                {resolvedTitle || defaultVideoTitle}
              </div>
              <div className="px-2.5 py-1 rounded-full bg-black/65 backdrop-blur-md border border-white/10 text-emerald-400 text-[10px] sm:text-xs font-semibold flex items-center space-x-1.5 shadow-md shrink-0">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]"></span>
                <span>Sincronizado</span>
              </div>
            </div>

            {/* Glowing Big Center Play Button (hover, tap or paused) */}
            {(!playing || isHoveringPlayer) && !useNativeControls && (
              <button
                onClick={handleTogglePlay}
                className="w-14 h-14 sm:w-18 sm:h-18 md:w-20 md:h-20 rounded-full bg-gradient-to-tr from-[#6366f1] to-[#a855f7] flex items-center justify-center shadow-[0_0_35px_rgba(168,85,247,0.8)] hover:scale-110 active:scale-95 transition-all z-20 cursor-pointer pointer-events-auto"
                title={isHost ? (playing ? 'Pausar' : 'Reproduzir') : 'Apenas o anfitrião controla o play/pause'}
              >
                {playing ? (
                  <Pause className="w-6 h-6 sm:w-8 sm:h-8 text-white fill-white" />
                ) : (
                  <Play className="w-6 h-6 sm:w-8 sm:h-8 text-white fill-white ml-1" />
                )}
              </button>
            )}

            {/* Aviso e Desbloqueio de Autoplay (Políticas de navegadores mobile/desktop) */}
            {autoplayBlocked && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute inset-0 z-40 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-4 sm:p-6 text-center space-y-3 sm:space-y-4 animate-in fade-in duration-300"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shadow-lg">
                  <VolumeX className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <div>
                  <h4 className="text-sm sm:text-base font-bold text-white">Toque para ativar som e vídeo</h4>
                  <p className="text-[11px] sm:text-xs text-[#94a3b8] max-w-xs sm:max-w-sm mt-1">
                    Seu navegador solicitou permissão para iniciar o áudio sincronizado.
                  </p>
                </div>
                <button
                  onClick={handleDismissAutoplay}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6366f1] text-white text-xs font-bold shadow-lg cursor-pointer active:scale-95 transition-all"
                >
                  Sincronizar Áudio e Vídeo
                </button>
              </div>
            )}
          </div>

          {/* DEDICATED SYNCPLAY MASTER CONTROL CONSOLE (Compacto no celular, completo no desktop) */}
          <div className="bg-[#111422] border-b lg:border border-[#1e2338] lg:rounded-2xl px-3 py-2.5 sm:p-4 shadow-xl space-y-2 sm:space-y-3">
            
            {/* Timeline Progress Bar / Scrubber */}
            <div className="relative flex items-center w-full py-1">
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={playedSeconds}
                onChange={handleSeekChange}
                onMouseDown={handleSeekMouseDown}
                onMouseUp={handleSeekMouseUp}
                onTouchStart={handleSeekMouseDown}
                onTouchEnd={handleSeekMouseUp}
                disabled={!isHost}
                className={`w-full h-2 rounded-lg appearance-none cursor-pointer transition-all ${
                  isHost ? 'accent-[#a855f7] bg-[#1e2338]' : 'accent-[#a855f7]/60 bg-[#161a29] cursor-default'
                }`}
                style={{
                  background: `linear-gradient(to right, #a855f7 ${(duration ? (playedSeconds / duration) * 100 : 0)}%, #1e2338 ${(duration ? (playedSeconds / duration) * 100 : 0)}%)`
                }}
              />
            </div>

            {/* Controls Bar */}
            <div className="flex items-center justify-between gap-2">
              
              {/* Left: Play/Pause, Volume, Time */}
              <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                
                {/* Play/Pause Button */}
                <button
                  onClick={handleTogglePlay}
                  className={`p-2 sm:p-2.5 rounded-xl transition-all cursor-pointer shrink-0 ${
                    isHost 
                      ? 'bg-gradient-to-r from-[#7c3aed] to-[#6366f1] text-white shadow-[0_0_15px_rgba(124,58,237,0.4)] active:scale-95'
                      : 'bg-[#1b1f33] text-[#64748b] cursor-not-allowed'
                  }`}
                >
                  {playing ? <Pause className="w-4 h-4 fill-white text-white" /> : <Play className="w-4 h-4 fill-white text-white ml-0.5" />}
                </button>

                {/* Local Audio Volume Control */}
                <div className="flex items-center space-x-2 bg-[#0d0f1a] px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-[#1e2338]">
                  <button 
                    onClick={handleToggleMute}
                    className="text-[#94a3b8] hover:text-white transition-colors cursor-pointer"
                    title={muted ? 'Desmutar' : 'Mutar áudio local'}
                  >
                    {muted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : volume < 0.5 ? (
                      <Volume1 className="w-4 h-4 text-white" />
                    ) : (
                      <Volume2 className="w-4 h-4 text-[#a855f7]" />
                    )}
                  </button>

                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.02"
                    value={muted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="hidden sm:block w-20 md:w-24 h-1.5 bg-[#1e2338] rounded-lg appearance-none cursor-pointer accent-[#a855f7]"
                  />

                  <span className="hidden md:inline text-[11px] font-mono text-[#94a3b8] w-7 text-right">
                    {muted ? '0%' : `${Math.round(volume * 100)}%`}
                  </span>
                </div>

                {/* Video Time Display */}
                <div className="flex items-center space-x-1 font-mono text-[11px] sm:text-xs text-[#94a3b8] bg-[#0d0f1a] px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-[#1e2338] shrink-0">
                  <span className="text-white font-bold">{formatTime(playedSeconds)}</span>
                  <span>/</span>
                  <span>{formatTime(duration)}</span>
                </div>

              </div>

              {/* Right: Speed, Native Toggle, Fullscreen */}
              <div className="flex items-center space-x-1.5 sm:space-x-2.5 shrink-0">
                
                {/* Playback Rate */}
                <button
                  onClick={() => {
                    if (!isHost) {
                      alert('Apenas o anfitrião pode alterar a velocidade.');
                      return;
                    }
                    const rates = [1.0, 1.25, 1.5, 2.0];
                    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
                    setPlaybackRate(nextRate);
                    postSyncState({ playbackRate: nextRate });
                  }}
                  className={`text-[11px] sm:text-xs font-bold px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border transition-colors cursor-pointer ${
                    isHost
                      ? 'bg-[#1b1f33] hover:bg-[#252b47] border-[#2b3352] text-[#c084fc]'
                      : 'bg-[#141829] border-[#1e2338] text-[#64748b] cursor-default'
                  }`}
                >
                  {playbackRate}x
                </button>

                {/* Toggle Native Controls */}
                {isHost && (
                  <button
                    onClick={() => setUseNativeControls(!useNativeControls)}
                    className={`text-xs font-semibold p-2 sm:px-3 sm:py-2 rounded-xl border transition-colors cursor-pointer flex items-center space-x-1.5 ${
                      useNativeControls
                        ? 'bg-[#201830] border-[#5a2e8c] text-[#c084fc]'
                        : 'bg-[#15192a] hover:bg-[#1d233d] border-[#242b45] text-[#94a3b8]'
                    }`}
                    title="Alternar controles nativos"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span className="hidden md:inline">{useNativeControls ? 'Nativos' : 'SyncPlay'}</span>
                  </button>
                )}

                {/* Fullscreen Button */}
                <button
                  onClick={toggleFullscreen}
                  className="p-2 sm:p-2.5 rounded-xl bg-[#1b1f33] hover:bg-[#252b47] border border-[#2b3352] text-white transition-colors cursor-pointer"
                  title="Tela Cheia"
                >
                  <Maximize className="w-4 h-4" />
                </button>

              </div>

            </div>
          </div>

          {/* MOBILE SWITCHER TABS (visível apenas em telas < lg, logo abaixo do vídeo!) */}
          <div className="grid grid-cols-3 lg:hidden bg-[#0e111d] border-b border-[#1a1e30]">
            <button
              type="button"
              onClick={() => handleSelectMobileTab('chat')}
              className={`py-2.5 text-xs font-bold flex items-center justify-center space-x-1.5 border-b-2 transition-colors ${
                mobileRoomTab === 'chat'
                  ? 'border-[#a855f7] text-white bg-[#131728]/60'
                  : 'border-transparent text-[#64748b]'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5 text-[#a855f7]" />
              <span>Chat</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-[#7c3aed] text-white text-[10px] font-extrabold">
                  {unreadCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSelectMobileTab('members')}
              className={`py-2.5 text-xs font-bold flex items-center justify-center space-x-1.5 border-b-2 transition-colors ${
                mobileRoomTab === 'members'
                  ? 'border-[#a855f7] text-white bg-[#131728]/60'
                  : 'border-transparent text-[#64748b]'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pessoas ({participants.length || 1})</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectMobileTab('info')}
              className={`py-2.5 text-xs font-bold flex items-center justify-center space-x-1.5 border-b-2 transition-colors ${
                mobileRoomTab === 'info'
                  ? 'border-[#a855f7] text-white bg-[#131728]/60'
                  : 'border-transparent text-[#64748b]'
              }`}
            >
              <Info className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>Detalhes</span>
            </button>
          </div>

          {/* Video Metadata, Active URL (mobile) & Sync Info (sempre visível no Desktop; no Celular aparece na aba Detalhes) */}
          <div className={`${mobileRoomTab === 'info' ? 'block p-4 space-y-4 pb-8' : 'hidden'} lg:block lg:space-y-4`}>
            {/* Mobile URL box */}
            <div className="flex lg:hidden items-center justify-between px-3.5 py-2.5 rounded-xl bg-[#111422] border border-[#1e2338] text-xs">
              <div className="flex items-center space-x-2 truncate">
                <span className="text-[#a855f7] font-semibold shrink-0">Vídeo:</span>
                <span className="text-[#94a3b8] font-mono truncate">{videoUrl}</span>
              </div>
              <button
                onClick={() => {
                  if (!videoUrl) return;
                  navigator.clipboard.writeText(videoUrl);
                  setUrlCopied(true);
                  setTimeout(() => setUrlCopied(false), 2000);
                }}
                className="text-[#c084fc] font-semibold ml-2 shrink-0"
              >
                {urlCopied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
              <div>
                <span className="text-[10px] font-bold tracking-widest text-[#a855f7] uppercase block mb-1">
                  REPRODUZINDO AGORA
                </span>
                <h2 className="text-xl sm:text-2xl font-extrabold text-white">{resolvedTitle || defaultVideoTitle}</h2>
                <p className="text-xs text-[#64748b] mt-1">
                  Sessão sincronizada • {isHost ? `Controlada por ${user?.name || 'você'}` : 'Sincronizada com o anfitrião'}
                </p>
              </div>

              {/* Watching count & Avatars */}
              <div className="flex items-center space-x-3">
                <div className="flex -space-x-2 overflow-hidden">
                  {(participants.length > 0 ? participants : [{ initials: user?.initials || 'U', color: 'bg-purple-600' }]).slice(0, 4).map((p, idx) => (
                    <span
                      key={p.socketId || p.id || idx}
                      className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${p.color || 'bg-[#5865F2]'} text-[10px] font-bold text-white ring-2 ring-[#0b0d14]`}
                      title={p.name}
                    >
                      {p.initials || 'U'}
                    </span>
                  ))}
                  {participants.length > 4 && (
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[#1e2338] text-[10px] font-bold text-[#94a3b8] ring-2 ring-[#0b0d14]">
                      +{participants.length - 4}
                    </span>
                  )}
                </div>
                <div className="text-xs">
                  <span className="text-white font-bold block">{participants.length || 1} assistindo</span>
                  <span className="text-emerald-400 font-medium text-[11px]">todos sincronizados</span>
                </div>
              </div>
            </div>

            {/* Sync Information Callout Card */}
            <div className="p-4 rounded-2xl bg-[#111422] border border-[#1e2338] flex items-start space-x-3.5 shadow-md">
              <div className="w-8 h-8 rounded-xl bg-[#201830] text-[#c084fc] flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">A reprodução está sincronizada</h4>
                <p className="text-xs text-[#94a3b8] mt-0.5">
                  Quando o anfitrião pausa, avança ou dá play, todos os dispositivos conectados acompanham automaticamente em tempo real.
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Right / Bottom Side: Discord Chat */}
        <div
          className={`${
            mobileRoomTab === 'info' ? 'hidden lg:flex' : 'flex flex-1 min-h-0'
          } lg:flex-none lg:w-96 lg:h-full`}
        >
          <DiscordChat
            roomId={roomId}
            roomTitle={resolvedTitle}
            currentUser={user}
            isHost={isHost}
            externalMessages={polledMessages}
            externalParticipants={participants}
            activeTab={chatPanelTab}
            onTabChange={(next) => {
              setChatPanelTab(next);
              setMobileRoomTab(next);
            }}
            onOpenInvite={() => setIsInviteOpen(true)}
          />
        </div>

      </div>

      {/* Invite Modal */}
      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        roomId={roomId}
        roomTitle={resolvedTitle}
      />

    </div>
  );
}
