import React, { useState, useEffect, useRef } from 'react';
import _ReactPlayer from 'react-player';
const ReactPlayer = _ReactPlayer.default || _ReactPlayer;
import { socket } from '../services/socket';

export function Room({ roomId, onLeave }) {
  const [isHost, setIsHost] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  
  // Estados locais reativos
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const [videoUrl, setVideoUrl] = useState('');
  
  // Referência para acessar a API imperativa do ReactPlayer
  const playerRef = useRef(null);

  // Sincronização do Ingressante (Late Joiner)
  useEffect(() => {
    socket.emit('request_initial_state', { roomId });

    const handleInitialState = (data) => {
      if (data.videoUrl) {
        setVideoUrl(data.videoUrl.trim().replace(/^http:\/\//i, 'https://'));
      }

      if (isHost) return;
      const player = playerRef.current;
      
      if (!player || typeof player.getCurrentTime !== 'function') return;

      const localTime = player.getCurrentTime();
      const drift = Math.abs(localTime - data.timestamp);

      // Só executa o seek forçado se o desvio for superior a 1.5 segundos
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

  useEffect(() => {
    // Tenta recuperar token existente no armazenamento local
    const savedToken = sessionStorage.getItem(`hostToken_${roomId}`);

    // 1. Isolamento: Entra no quarto virtual enviando o token se houver
    socket.emit('join_room', { roomId, hostToken: savedToken });

    // Listener para o papel designado pelo servidor
    const handleRoleAssigned = (data) => {
      setIsHost(data.isHost);
      
      if (data.isHost && data.hostToken) {
        // Grava o token recém-criado (ou renovado) no navegador
        sessionStorage.setItem(`hostToken_${roomId}`, data.hostToken);
      }
      
      if (data.videoUrl) {
        setVideoUrl(data.videoUrl.trim().replace(/^http:\/\//i, 'https://'));
      }
    };
    socket.on('role_assigned', handleRoleAssigned);

    // Listener para rejeição de criação (Plano expirado)
    const handleCreationRejected = (data) => {
      setErrorMsg(data.message);
    };
    socket.on('creation_rejected', handleCreationRejected);

    // Listener para rejeição de ingresso (Sala Inexistente/Mitigação DDoS)
    const handleJoinRejected = (data) => {
      setErrorMsg(data.message);
    };
    socket.on('join_rejected', handleJoinRejected);

    // Listener de destruição da sala (Host Drop)
    const handleHostTimeoutKick = () => {
      sessionStorage.removeItem(`hostToken_${roomId}`);
      setErrorMsg('A sala foi encerrada pelo servidor porque o Anfitrião perdeu a conexão.');
    };
    socket.on('host_timeout_kick', handleHostTimeoutKick);

    // 2. Ouvinte passivo para o motor de sincronização (reage aos comandos da rede)
    const handleSyncCommand = (data) => {
      // Ignora comandos se for o host (o host dita as regras)
      if (isHost) return;

      const player = playerRef.current;
      if (!player || typeof player.getCurrentTime !== 'function') return;

      // Sincroniza o tempo apenas se o desvio for maior que 1.5s (evita stuttering)
      if (data.timestamp !== undefined) {
         const localTime = player.getCurrentTime();
         const drift = Math.abs(localTime - data.timestamp);
         
         if (drift > 1.5) {
            player.seekTo(data.timestamp, 'seconds');
         }
      }

      if (data.action === 'play') {
        setPlaying(true);
      } else if (data.action === 'pause') {
        setPlaying(false);
      } else if (data.action === 'buffer') {
        // Se o anfitrião está carregando (buffer), pausa temporariamente para os espectadores
        setPlaying(false);
      }
    };

    socket.on('sync_command', handleSyncCommand);

    return () => {
      socket.off('role_assigned', handleRoleAssigned);
      socket.off('creation_rejected', handleCreationRejected);
      socket.off('join_rejected', handleJoinRejected);
      socket.off('host_timeout_kick', handleHostTimeoutKick);
      socket.off('sync_command', handleSyncCommand);
    };
  }, [roomId, isHost]);

  // Handler para emitir eventos apenas se for o host
  const emitVideoCommand = (action) => {
    if (!isHost) return;
    const player = playerRef.current;
    if (!player || typeof player.getCurrentTime !== 'function') return;

    socket.emit('video_command', {
      roomId,
      action,
      timestamp: player.getCurrentTime()
    });
  };

  // Interceptadores do fluxo do Anfitrião
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

  const handleCopyLink = () => {
    const link = `${window.location.origin}/${roomId}`;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  if (errorMsg) {
    return (
      <div className="p-12 bg-red-900/20 border border-red-500/50 rounded-lg flex flex-col items-center">
        <h2 className="text-2xl font-bold text-red-400 mb-4">Acesso Negado</h2>
        <p className="text-gray-300 mb-6 max-w-md text-center">{errorMsg}</p>
        <button 
          onClick={onLeave}
          className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-md font-bold transition-colors"
        >
          Voltar ao Início
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="w-full flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-purple-400">Sala: <span className="text-gray-300 font-mono text-lg">{roomId}</span></h2>
        <button 
          onClick={onLeave}
          className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg font-medium text-sm transition-colors"
        >
          Sair da Sala
        </button>
      </div>
      
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between w-full max-w-[800px] gap-4">
        {isHost ? (
          <div className="flex items-center space-x-2 bg-purple-900/40 px-4 py-2 rounded-lg border border-purple-500/50 flex-1">
            <span className="text-xl">👑</span>
            <span className="text-purple-300 font-bold">Você é o Anfitrião</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2 bg-gray-800 px-4 py-2 rounded-lg border border-gray-600 flex-1">
            <span className="text-xl">👀</span>
            <span className="text-gray-300 font-bold">Modo Espectador</span>
          </div>
        )}

        <button 
          onClick={handleCopyLink}
          className={`flex items-center justify-center space-x-2 px-4 py-2 rounded-lg font-bold border transition-colors ${linkCopied ? 'bg-green-600/20 text-green-400 border-green-500/50' : 'bg-gray-800 text-gray-300 border-gray-600 hover:bg-gray-700'}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
          <span>{linkCopied ? 'Copiado!' : 'Copiar Convite'}</span>
        </button>
      </div>
      
      {/* DEBUGER DA URL */}
      <div className="w-full max-w-[800px] mb-4 bg-gray-800 p-2 rounded text-xs text-gray-400 font-mono break-all">
        URL Ativa: {videoUrl}
      </div>

      <div className={`relative flex items-center justify-center rounded-lg overflow-hidden border border-gray-700 shadow-2xl min-h-[450px] bg-black ${!isHost ? 'pointer-events-none' : ''}`}>
        {videoUrl ? (
          <ReactPlayer 
            ref={playerRef}
            url={videoUrl.trim()}
            playing={playing}
            controls={isHost}
            playbackRate={playbackRate}
            onPlay={handlePlay}
            onPause={handlePause}
            onBuffer={handleBuffer}
            width="800px"
            height="450px"
          />
        ) : (
          <div className="text-gray-500 animate-pulse">Carregando player...</div>
        )}
        
        {!isHost && (
          <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded font-bold">
            Modo Espectador
          </div>
        )}
      </div>
    </div>
  );
}
