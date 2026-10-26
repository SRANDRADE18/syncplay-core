import React, { useState, useEffect, useRef } from 'react';
import _ReactPlayer from 'react-player';
const ReactPlayer = _ReactPlayer.default || _ReactPlayer;
import { socket } from '../services/socket';
import { 
  ChevronLeft, Play, Pause, Volume2, VolumeX, Volume1, Maximize, 
  Settings, UserPlus, Smile, Send, Sparkles, MoreVertical, 
  Crown, Eye, Link2, Check, Sliders
} from 'lucide-react';
import { InviteModal } from './InviteModal';
import { DiscordChat } from './DiscordChat';

export function Room({ 
  roomId, 
  roomTitle = 'Noite de ficção científica', 
  defaultVideoTitle = 'Horizonte Neon', 
  initialVideoUrl, 
  onLeave, 
  user 
}) {
  const [isHost, setIsHost] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  
  // Player states
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [volume, setVolume] = useState(0.85); // 0.0 to 1.0
  const [muted, setMuted] = useState(false);
  const [playedSeconds, setPlayedSeconds] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [useNativeControls, setUseNativeControls] = useState(false);
  const [isHoveringPlayer, setIsHoveringPlayer] = useState(false);

  const [videoUrl, setVideoUrl] = useState(() => {
    if (initialVideoUrl && initialVideoUrl.trim()) {
      return initialVideoUrl.trim().replace(/^http:\/\//i, 'https://');
    }
    return 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
  });

  // URL edit input for host
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [newUrlInput, setNewUrlInput] = useState('');
  const [urlCopied, setUrlCopied] = useState(false);

  const [participants, setParticipants] = useState([]);
  const playerRef = useRef(null);
  const playerContainerRef = useRef(null);

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

  // Sincronização do Ingressante (Late Joiner)
  useEffect(() => {
    socket.emit('request_initial_state', { roomId });

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

  // Gestão de papéis e sincronização de comandos
  useEffect(() => {
    const savedToken = sessionStorage.getItem(`hostToken_${roomId}`);
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

    const handleRoleAssigned = (data) => {
      setIsHost(data.isHost);
      if (data.isHost && data.hostToken) {
        sessionStorage.setItem(`hostToken_${roomId}`, data.hostToken);
      }
      if (data.videoUrl && data.videoUrl.trim()) {
        setVideoUrl(data.videoUrl.trim().replace(/^http:\/\//i, 'https://'));
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

    return () => {
      socket.off('role_assigned', handleRoleAssigned);
      socket.off('creation_rejected', handleCreationRejected);
      socket.off('join_rejected', handleJoinRejected);
      socket.off('host_timeout_kick', handleHostTimeoutKick);
      socket.off('sync_command', handleSyncCommand);
      socket.off('video_url_changed', handleVideoUrlChanged);
      socket.off('room_participants_update', handleParticipantsUpdate);
    };
  }, [roomId, isHost, user]);

  // Handler para emitir eventos apenas se for o host
  const emitVideoCommand = (action, customTimestamp) => {
    if (!isHost) return;
    const player = playerRef.current;
    if (!player || typeof player.getCurrentTime !== 'function') return;

    socket.emit('video_command', {
      roomId,
      action,
      timestamp: customTimestamp !== undefined ? customTimestamp : player.getCurrentTime()
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

  const handleTogglePlay = () => {
    if (!isHost) {
      alert('Apenas o anfitrião pode controlar a reprodução do vídeo para a sala.');
      return;
    }
    const nextState = !playing;
    setPlaying(nextState);
    emitVideoCommand(nextState ? 'play' : 'pause');
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

  const toggleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (!document.fullscreenElement) {
      playerContainerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleChangeVideoUrl = (e) => {
    e.preventDefault();
    if (!newUrlInput.trim()) return;
    const clean = newUrlInput.trim().replace(/^http:\/\//i, 'https://');
    setVideoUrl(clean);
    setPlaying(false);
    setPlayedSeconds(0);
    socket.emit('change_video_url', { roomId, videoUrl: clean });
    setShowUrlInput(false);
    setNewUrlInput('');
  };



  if (errorMsg) {
    return (
      <div className="p-8 max-w-lg mx-auto bg-[#1a121d] border border-rose-500/40 rounded-3xl text-center space-y-4 my-12 shadow-2xl">
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
    <div className="flex flex-col h-[calc(100vh-2rem)] select-none animate-in fade-in duration-300">
      
      {/* Top Watch Room Header */}
      <header className="h-16 border-b border-[#1a1e30] flex items-center justify-between px-6 bg-[#0d101a] shrink-0">
        <div className="flex items-center space-x-4">
          <button
            onClick={onLeave}
            className="p-2 rounded-xl text-[#94a3b8] hover:text-white hover:bg-[#151929] transition-colors cursor-pointer"
            title="Voltar ao início"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#6366f1] to-[#a855f7] flex items-center justify-center shadow-[0_0_15px_rgba(168,85,247,0.5)]">
              <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center space-x-2">
                <span>{roomTitle}</span>
              </h2>
              <div className="flex items-center space-x-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_#34d399]"></span>
                <span className="text-[11px] font-medium text-emerald-400">Sincronizado</span>
                <span className="text-[10px] text-[#475569]">•</span>
                <span className="text-[11px] text-[#a855f7] font-semibold flex items-center space-x-1">
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
        <div className="flex items-center space-x-3">
          {isHost && (
            <button
              onClick={() => setShowUrlInput(!showUrlInput)}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#a855f7] hover:text-white bg-[#171a2b] hover:bg-[#20253d] border border-[#262c47] flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Trocar URL do Vídeo (YouTube, MP4, etc.)"
            >
              <Link2 className="w-4 h-4" />
              <span>Trocar Vídeo</span>
            </button>
          )}

          <button
            onClick={() => setIsInviteOpen(true)}
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl font-bold text-xs text-white bg-[#1b1f32] hover:bg-[#252b47] border border-[#2b3252] shadow-sm transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4 text-[#a855f7]" />
            <span>Convidar</span>
            <span className="w-5 h-5 rounded-full bg-[#7c3aed] text-white text-[10px] flex items-center justify-center font-bold">
              +2
            </span>
          </button>
        </div>
      </header>

      {/* Host URL Change Bar (if opened) */}
      {showUrlInput && isHost && (
        <form onSubmit={handleChangeVideoUrl} className="bg-[#141829] border-b border-[#202742] p-4 flex items-center space-x-3 animate-in slide-in-from-top-2 duration-200">
          <div className="relative flex-1">
            <Link2 className="w-4 h-4 text-[#64748b] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="url"
              required
              value={newUrlInput}
              onChange={(e) => setNewUrlInput(e.target.value)}
              placeholder="Cole novo link do YouTube, Vimeo ou MP4 direto..."
              className="w-full bg-[#0d0f1a] border border-[#232942] rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-[#64748b] focus:outline-none focus:border-[#a855f7]"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6366f1] text-white font-bold text-xs hover:from-[#6d28d9] hover:to-[#4f46e5] transition-all cursor-pointer shadow-md"
          >
            Atualizar Vídeo para Todos
          </button>
          <button
            type="button"
            onClick={() => setShowUrlInput(false)}
            className="px-3 py-2.5 rounded-xl bg-[#1e2338] text-[#94a3b8] hover:text-white text-xs font-semibold"
          >
            Cancelar
          </button>
        </form>
      )}

      {/* Main Content: Player (Left) + Chat (Right) */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left Side: Video Player Area */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          
          {/* Active URL Info bar */}
          <div className="flex items-center justify-between px-4 py-2 rounded-xl bg-[#111422] border border-[#1e2338] text-xs">
            <div className="flex items-center space-x-2 truncate">
              <span className="text-[#a855f7] font-semibold">URL Ativa:</span>
              <span className="text-[#94a3b8] font-mono truncate">{videoUrl}</span>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(videoUrl);
                setUrlCopied(true);
                setTimeout(() => setUrlCopied(false), 2000);
              }}
              className="text-[#64748b] hover:text-white ml-2 shrink-0 cursor-pointer"
            >
              {urlCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : 'Copiar'}
            </button>
          </div>

          {/* Video Container Box */}
          <div 
            ref={playerContainerRef}
            onMouseEnter={() => setIsHoveringPlayer(true)}
            onMouseLeave={() => setIsHoveringPlayer(false)}
            className="relative w-full aspect-video bg-black rounded-3xl overflow-hidden border border-[#1e2338] shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex items-center justify-center group"
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
                  controls={useNativeControls ? isHost : false}
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onBuffer={handleBuffer}
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
                        rel: 0
                      }
                    }
                  }}
                />
              </div>
            ) : (
              <div className="text-gray-500 animate-pulse text-sm">Carregando player...</div>
            )}

            {/* Overlay Top Badge */}
            <div className={`absolute top-4 left-5 right-5 flex justify-between items-center transition-opacity duration-300 pointer-events-none z-20 ${isHoveringPlayer || !playing ? 'opacity-100' : 'opacity-0'}`}>
              <div className="text-sm font-bold text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                {roomTitle || defaultVideoTitle}
              </div>
              <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-emerald-400 text-xs font-semibold flex items-center space-x-1.5 shadow-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]"></span>
                <span>Todos sincronizados</span>
              </div>
            </div>

            {/* Glowing Big Center Play Button (hover or paused) */}
            {(!playing || isHoveringPlayer) && !useNativeControls && (
              <button
                onClick={handleTogglePlay}
                className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-tr from-[#6366f1] to-[#a855f7] flex items-center justify-center shadow-[0_0_35px_rgba(168,85,247,0.8)] hover:scale-110 active:scale-95 transition-all z-20 cursor-pointer pointer-events-auto"
                title={isHost ? (playing ? 'Pausar' : 'Reproduzir') : 'Apenas o anfitrião controla o play/pause'}
              >
                {playing ? (
                  <Pause className="w-7 h-7 md:w-8 md:h-8 text-white fill-white" />
                ) : (
                  <Play className="w-7 h-7 md:w-8 md:h-8 text-white fill-white ml-1" />
                )}
              </button>
            )}

            {/* Spectator Badge Overlay */}
            {!isHost && (
              <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-md border border-white/10 text-white text-xs px-3.5 py-1.5 rounded-full font-bold shadow-xl flex items-center space-x-2 pointer-events-none z-30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]"></span>
                <span>Modo Espectador</span>
              </div>
            )}
          </div>

          {/* DEDICATED SYNCPLAY MASTER CONTROL CONSOLE (matching Figma prototype) */}
          <div className="bg-[#111422] border border-[#1e2338] rounded-2xl p-4 shadow-xl space-y-3">
            
            {/* Timeline Progress Bar / Scrubber */}
            <div className="space-y-1.5">
              <div className="relative flex items-center w-full">
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
            </div>

            {/* Controls Bar: Play, Volume, Time, Speed, Mode Toggle, Fullscreen */}
            <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
              
              {/* Left: Play/Pause, Volume, Time */}
              <div className="flex items-center space-x-4">
                
                {/* Play/Pause Button */}
                <button
                  onClick={handleTogglePlay}
                  className={`p-2.5 rounded-xl transition-all cursor-pointer ${
                    isHost 
                      ? 'bg-gradient-to-r from-[#7c3aed] to-[#6366f1] text-white shadow-[0_0_15px_rgba(124,58,237,0.4)] hover:brightness-110 active:scale-95'
                      : 'bg-[#1b1f33] text-[#64748b] cursor-not-allowed'
                  }`}
                  title={isHost ? (playing ? 'Pausar (Espalha para todos)' : 'Dar Play (Espalha para todos)') : 'Apenas o anfitrião pode controlar'}
                >
                  {playing ? <Pause className="w-4 h-4 fill-white text-white" /> : <Play className="w-4 h-4 fill-white text-white ml-0.5" />}
                </button>

                {/* Local Audio Volume Control */}
                <div className="flex items-center space-x-2 bg-[#0d0f1a] px-3 py-2 rounded-xl border border-[#1e2338]">
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
                    className="w-20 md:w-24 h-1.5 bg-[#1e2338] rounded-lg appearance-none cursor-pointer accent-[#a855f7]"
                    title={`Volume local: ${Math.round((muted ? 0 : volume) * 100)}%`}
                  />

                  <span className="text-[11px] font-mono text-[#94a3b8] w-7 text-right">
                    {muted ? '0%' : `${Math.round(volume * 100)}%`}
                  </span>
                </div>

                {/* Video Time Display */}
                <div className="flex items-center space-x-1.5 font-mono text-xs text-[#94a3b8] bg-[#0d0f1a] px-3 py-2 rounded-xl border border-[#1e2338]">
                  <span className="text-white font-bold">{formatTime(playedSeconds)}</span>
                  <span>/</span>
                  <span>{formatTime(duration)}</span>
                </div>

              </div>

              {/* Right: Speed, Native Toggle, Fullscreen */}
              <div className="flex items-center space-x-2.5">
                
                {/* Playback Rate */}
                <button
                  onClick={() => {
                    if (!isHost) {
                      alert('Apenas o anfitrião pode alterar a velocidade.');
                      return;
                    }
                    const rates = [1.0, 1.25, 1.5, 2.0];
                    const nextIndex = (rates.indexOf(playbackRate) + 1) % rates.length;
                    setPlaybackRate(rates[nextIndex]);
                  }}
                  className={`text-xs font-bold px-3 py-2 rounded-xl border transition-colors cursor-pointer ${
                    isHost
                      ? 'bg-[#1b1f33] hover:bg-[#252b47] border-[#2b3352] text-[#c084fc]'
                      : 'bg-[#141829] border-[#1e2338] text-[#64748b] cursor-default'
                  }`}
                  title={isHost ? 'Alterar velocidade de reprodução' : 'Velocidade controlada pelo anfitrião'}
                >
                  {playbackRate}x
                </button>

                {/* Toggle Native YouTube Controls (if user wants native YouTube overlays) */}
                {isHost && (
                  <button
                    onClick={() => setUseNativeControls(!useNativeControls)}
                    className={`text-xs font-semibold px-3 py-2 rounded-xl border transition-colors cursor-pointer flex items-center space-x-1.5 ${
                      useNativeControls
                        ? 'bg-[#201830] border-[#5a2e8c] text-[#c084fc]'
                        : 'bg-[#15192a] hover:bg-[#1d233d] border-[#242b45] text-[#94a3b8]'
                    }`}
                    title="Alternar entre controles do SyncPlay e controles nativos do player"
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>{useNativeControls ? 'Controles Nativos' : 'Controles SyncPlay'}</span>
                  </button>
                )}

                {/* Fullscreen Button */}
                <button
                  onClick={toggleFullscreen}
                  className="p-2.5 rounded-xl bg-[#1b1f33] hover:bg-[#252b47] border border-[#2b3352] text-white transition-colors cursor-pointer"
                  title="Tela Cheia"
                >
                  <Maximize className="w-4 h-4" />
                </button>

              </div>

            </div>

          </div>

          {/* Video Metadata & Live Audience */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-1">
            <div>
              <span className="text-[10px] font-bold tracking-widest text-[#a855f7] uppercase block mb-1">
                REPRODUZINDO AGORA
              </span>
              <h2 className="text-2xl font-extrabold text-white">{roomTitle || defaultVideoTitle}</h2>
              <p className="text-xs text-[#64748b] mt-1">
                Fonte externa • Sala criada por {isHost ? (user?.name || 'você') : 'Anfitrião'}
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
                Quando o anfitrião pausa, avança ou dá play, todos os espectadores acompanham automaticamente em tempo real. Cada usuário pode ajustar seu volume local independentemente.
              </p>
            </div>
          </div>

        </div>

        {/* Right Side: Discord Chat */}
        <DiscordChat
          roomId={roomId}
          roomTitle={roomTitle}
          currentUser={user}
          isHost={isHost}
          onOpenInvite={() => setIsInviteOpen(true)}
        />

      </div>

      {/* Invite Modal */}
      <InviteModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        roomId={roomId}
        roomTitle={roomTitle}
      />

    </div>
  );
}
