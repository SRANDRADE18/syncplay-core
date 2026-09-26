import { useEffect, useState } from 'react'
import { socket } from './services/socket'
import { Room } from './components/Room'
import './index.css'

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [activeRoomId, setActiveRoomId] = useState(null);
  
  // States para o formulário da Dashboard
  const [joinRoomIdInput, setJoinRoomIdInput] = useState('');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [dashboardError, setDashboardError] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
      setDashboardError('');
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    // Listener para o retorno da criação da sala
    function onRoomCreated(data) {
      setIsCreating(false);
      if (data.hostToken) {
        sessionStorage.setItem(`hostToken_${data.roomId}`, data.hostToken);
      }
      setActiveRoomId(data.roomId);
    }

    function onCreationRejected(data) {
      setIsCreating(false);
      setDashboardError(data.message || 'Erro ao criar sala.');
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('room_created', onRoomCreated);
    socket.on('creation_rejected', onCreationRejected);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room_created', onRoomCreated);
      socket.off('creation_rejected', onCreationRejected);
    };
  }, []);

  const handleCreateRoom = (e) => {
    e.preventDefault();
    if (!isConnected) {
      setDashboardError('Não conectado ao servidor Socket.io');
      return;
    }
    setDashboardError('');
    setIsCreating(true);
    socket.emit('create_room', { video_url: videoUrlInput });
  };

  const handleJoinRoom = (e) => {
    e.preventDefault();
    if (!joinRoomIdInput.trim()) {
      setDashboardError('Digite o ID ou URL da sala.');
      return;
    }
    // Extrai o UUID da URL caso o usuário tenha colado o link inteiro
    let targetRoomId = joinRoomIdInput.trim();
    if (targetRoomId.includes('/')) {
      const parts = targetRoomId.split('/');
      targetRoomId = parts[parts.length - 1];
    }
    
    setDashboardError('');
    setActiveRoomId(targetRoomId);
  };

  const handleLeaveRoom = () => {
    setActiveRoomId(null);
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-900 text-white font-sans selection:bg-purple-500/50">
      {/* Header Fixo */}
      <header className="w-full bg-gray-950/80 backdrop-blur-md border-b border-gray-800 p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-500 bg-clip-text text-transparent cursor-pointer" onClick={() => setActiveRoomId(null)}>
            SyncPlay
          </h1>
          <div className="flex items-center space-x-3 bg-gray-900 px-4 py-2 rounded-full border border-gray-800 shadow-inner">
            <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]'}`}></div>
            <span className="font-mono text-xs tracking-wider text-gray-300">
              {isConnected ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-7xl mx-auto flex-1 p-6 flex flex-col items-center justify-center">
        {activeRoomId ? (
          <div className="w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
             <Room roomId={activeRoomId} onLeave={handleLeaveRoom} />
          </div>
        ) : (
          <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 animate-in fade-in zoom-in-95 duration-500">
            
            {/* Lado Esquerdo: Criar Sala */}
            <div className="bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl border border-gray-700/50 shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
              <h2 className="text-3xl font-extrabold mb-2 text-white relative z-10">Criar Nova Sala</h2>
              <p className="text-gray-400 mb-8 relative z-10">Seja o anfitrião e controle a reprodução para todos os seus amigos com latência zero.</p>
              
              <form onSubmit={handleCreateRoom} className="space-y-5 relative z-10">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">URL do Vídeo (Opcional)</label>
                  <input 
                    type="url" 
                    value={videoUrlInput}
                    onChange={(e) => setVideoUrlInput(e.target.value)}
                    placeholder="https://youtube.com/watch?v=..."
                    className="w-full bg-gray-900/80 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={!isConnected || isCreating}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold py-3 px-4 rounded-lg shadow-[0_0_15px_rgba(147,51,234,0.3)] hover:shadow-[0_0_25px_rgba(147,51,234,0.5)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex justify-center items-center"
                >
                  {isCreating ? (
                    <span className="flex items-center space-x-2">
                       <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                       <span>Gerando...</span>
                    </span>
                  ) : 'Criar Sessão Premium'}
                </button>
              </form>
            </div>

            {/* Lado Direito: Entrar em Sala */}
            <div className="bg-gray-800/30 backdrop-blur-sm p-8 rounded-2xl border border-gray-700/50 shadow-xl relative overflow-hidden group">
               <div className="absolute inset-0 bg-gradient-to-bl from-pink-600/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
              <h2 className="text-3xl font-extrabold mb-2 text-white relative z-10">Entrar em Sessão</h2>
              <p className="text-gray-400 mb-8 relative z-10">Possui um convite? Cole o ID da sala ou o link direto para assistir junto.</p>
              
              <form onSubmit={handleJoinRoom} className="space-y-5 relative z-10 flex flex-col h-[calc(100%-100px)] justify-end">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">ID da Sala ou Convite</label>
                  <input 
                    type="text" 
                    value={joinRoomIdInput}
                    onChange={(e) => setJoinRoomIdInput(e.target.value)}
                    placeholder="Cole aqui..."
                    required
                    className="w-full bg-gray-900/80 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                  />
                </div>
                <button 
                  type="submit"
                  disabled={!isConnected}
                  className="w-full bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white font-bold py-3 px-4 rounded-lg transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  Conectar como Espectador
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Global Error Toast */}
        {dashboardError && !activeRoomId && (
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-red-900/90 border border-red-500 text-red-100 px-6 py-3 rounded-lg shadow-2xl flex items-center space-x-3 animate-in fade-in slide-in-from-bottom-5">
            <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span className="font-medium">{dashboardError}</span>
            <button onClick={() => setDashboardError('')} className="ml-4 hover:text-white">&times;</button>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
