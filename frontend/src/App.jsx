import React, { useEffect, useState } from 'react';
import { socket, updateSocketAuth } from './services/socket';
import { Sidebar } from './components/Sidebar';
import { AuthScreen } from './components/AuthScreen';
import { DashboardView } from './components/DashboardView';
import { MinhasSalasView } from './components/MinhasSalasView';
import { CriarSalaView } from './components/CriarSalaView';
import { IndicacoesView } from './components/IndicacoesView';
import { PerfilPlanoView } from './components/PerfilPlanoView';
import { Room } from './components/Room';

const DEFAULT_ROOMS = [
  {
    id: 'noite-de-ficcao-cientifica',
    title: 'Noite de ficção científica',
    videoTitle: 'Horizonte Neon',
    type: 'YOUTUBE',
    date: 'Hoje, 21:00',
    participants: 5,
    image: '/horizonte_neon.jpg',
    isPrimary: true,
    url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  },
  {
    id: 'maratona-de-domingo',
    title: 'Maratona de domingo',
    videoTitle: 'Big Buck Bunny (MP4)',
    type: 'VÍDEO EXTERNO',
    date: '18 mai 2025',
    participants: 4,
    image: '/maratona.jpg',
    isPrimary: false,
    url: 'https://www.w3schools.com/html/mov_bbb.mp4'
  },
  {
    id: 'sessao-de-estudos',
    title: 'Sessão de estudos',
    videoTitle: 'Lofi Hip Hop Radio',
    type: 'YOUTUBE',
    date: '12 mai 2025',
    participants: 7,
    image: '/estudos.jpg',
    isTemporary: true,
    isPrimary: false,
    url: 'https://www.youtube.com/watch?v=jfKfPfyJRdk'
  },
  {
    id: 'clube-do-suspense',
    title: 'Clube do suspense',
    videoTitle: 'Tears of Steel',
    type: 'STREAMING EXTERNO',
    date: '03 mai 2025',
    participants: 3,
    image: '/horizonte_neon.jpg',
    isPrimary: false,
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'
  }
];

function App() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('syncplay_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    // Usuário padrão do protótipo Figma
    return {
      id: 'b1c8508b-f98c-4b9d-89f4-3fc09973e176',
      name: 'Luna Martins',
      initials: 'LM',
      email: 'test@syncplay.com',
      plan: 'Plano Vibe',
      daysLeft: 23,
      referral_code: 'LUNA30',
      sessionsCount: 12,
      referralsCount: 3
    };
  });

  const [currentTab, setCurrentTab] = useState('inicio');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);

  // Lista de salas persistida em localStorage
  const [rooms, setRooms] = useState(() => {
    const saved = localStorage.getItem('syncplay_rooms');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // Ignora erro de parse e usa salas padrão
      }
    }
    return DEFAULT_ROOMS;
  });

  const [activeRoom, setActiveRoom] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');
    if (!roomParam) return null;
    const existing = rooms.find((r) => r.id === roomParam);
    if (existing) return existing;
    return {
      id: roomParam,
      title: 'Sessão Compartilhada',
      videoTitle: 'Vídeo ao Vivo',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    };
  });

  // Socket connection listeners
  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    function onRoomCreated(data) {
      setIsCreatingRoom(false);
      if (data.hostToken) {
        sessionStorage.setItem(`hostToken_${data.roomId}`, data.hostToken);
      }

      const newRoom = {
        id: data.roomId,
        title: data.roomName || 'Nova Sessão SyncPlay',
        videoTitle: data.roomName || 'Vídeo Sincronizado',
        type: data.videoUrl?.includes('youtube') || data.videoUrl?.includes('youtu.be') ? 'YOUTUBE' : 'VÍDEO EXTERNO',
        date: 'Hoje, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        participants: 1,
        image: data.videoUrl?.includes('youtube') ? '/maratona.jpg' : '/horizonte_neon.jpg',
        isPrimary: true,
        url: data.videoUrl
      };

      setRooms((prev) => {
        const updated = [newRoom, ...prev.filter((r) => r.id !== data.roomId)];
        localStorage.setItem('syncplay_rooms', JSON.stringify(updated));
        return updated;
      });

      setActiveRoom(newRoom);
    }

    function onCreationRejected(data) {
      setIsCreatingRoom(false);
      alert(data.message || 'Erro ao criar sala.');
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

  const handleLoginSuccess = (user, token) => {
    setCurrentUser(user);
    localStorage.setItem('syncplay_user', JSON.stringify(user));
    if (token) {
      updateSocketAuth(token);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('syncplay_user');
    updateSocketAuth(null);
    setActiveRoom(null);
  };

  const handleCreateRoom = ({ title, video_url }) => {
    setIsCreatingRoom(true);
    const cleanUrl = video_url ? video_url.trim() : 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const cleanTitle = title ? title.trim() : 'Nova Sessão SyncPlay';

    if (!socket.connected) {
      // Fallback offline caso o servidor esteja desconectado
      setTimeout(() => {
        setIsCreatingRoom(false);
        const demoRoom = {
          id: `room-${Date.now()}`,
          title: cleanTitle,
          videoTitle: cleanTitle,
          type: cleanUrl.includes('youtube') ? 'YOUTUBE' : 'VÍDEO EXTERNO',
          date: 'Hoje, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          participants: 1,
          image: cleanUrl.includes('youtube') ? '/maratona.jpg' : '/horizonte_neon.jpg',
          isPrimary: true,
          url: cleanUrl
        };
        setRooms((prev) => {
          const updated = [demoRoom, ...prev];
          localStorage.setItem('syncplay_rooms', JSON.stringify(updated));
          return updated;
        });
        setActiveRoom(demoRoom);
      }, 500);
      return;
    }

    socket.emit('create_room', { video_url: cleanUrl, roomName: cleanTitle });
  };

  const handleDeleteRoom = (roomId) => {
    setRooms((prev) => {
      const updated = prev.filter((r) => r.id !== roomId);
      localStorage.setItem('syncplay_rooms', JSON.stringify(updated));
      return updated;
    });

    if (socket.connected) {
      socket.emit('delete_room', { roomId });
    }

    if (activeRoom && activeRoom.id === roomId) {
      setActiveRoom(null);
    }
  };

  const handleOpenRoom = (roomId, title, url, videoTitle) => {
    const existing = rooms.find((r) => r.id === roomId);
    setActiveRoom({
      id: roomId,
      title: title || existing?.title || 'Noite de ficção científica',
      videoTitle: videoTitle || existing?.videoTitle || 'Horizonte Neon',
      url: url || existing?.url || 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    });
  };

  // Se não estiver logado, exibe a AuthScreen
  if (!currentUser) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // Se estiver dentro de uma sala de vídeo ativa
  if (activeRoom) {
    return (
      <div className="min-h-screen bg-[#0b0d14] text-white">
        <Room
          roomId={activeRoom.id}
          roomTitle={activeRoom.title}
          defaultVideoTitle={activeRoom.videoTitle}
          initialVideoUrl={activeRoom.url}
          onLeave={() => setActiveRoom(null)}
          user={currentUser}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0d14] text-white flex">
      {/* Figma Sidebar */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        user={currentUser}
        onLogout={handleLogout}
        onOpenCreateRoom={() => setCurrentTab('criar_sala')}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Navbar */}
        <header className="h-16 border-b border-[#1a1e30] bg-[#0d101a]/80 backdrop-blur-md px-8 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center space-x-3 text-xs text-[#94a3b8]">
            <span className="font-semibold text-white">SyncPlay</span>
            <span>/</span>
            <span className="capitalize text-[#c084fc] font-medium">
              {currentTab.replace('_', ' ')}
            </span>
          </div>

          <div className="flex items-center space-x-4">
            {/* Connection Status Badge */}
            <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-[#131625] border border-[#1e2338]">
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400'}`}></span>
              <span className="text-[11px] font-mono text-[#94a3b8] tracking-wider uppercase">
                {isConnected ? 'ONLINE' : 'DESCONECTADO'}
              </span>
            </div>

            {/* Quick Demo Switcher to Auth view */}
            <button
              onClick={() => setCurrentUser(null)}
              className="text-[11px] font-medium text-[#64748b] hover:text-[#a855f7] px-2.5 py-1 rounded-lg border border-[#1e2338] hover:border-[#382b52] transition-colors cursor-pointer"
              title="Alternar para tela de Login/Cadastro do Figma"
            >
              Ver Tela de Login
            </button>
          </div>
        </header>

        {/* Dynamic Page Views */}
        <main className="flex-1 p-6 md:p-10 max-w-7xl w-full mx-auto">
          {currentTab === 'inicio' && (
            <DashboardView
              user={currentUser}
              onOpenCreateRoom={() => setCurrentTab('criar_sala')}
              onOpenRoom={handleOpenRoom}
              onNavigateTab={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'minhas_salas' && (
            <MinhasSalasView
              rooms={rooms}
              onDeleteRoom={handleDeleteRoom}
              onOpenRoom={handleOpenRoom}
              onOpenCreateRoom={() => setCurrentTab('criar_sala')}
            />
          )}

          {currentTab === 'criar_sala' && (
            <CriarSalaView
              onCreateRoom={handleCreateRoom}
              isCreating={isCreatingRoom}
            />
          )}

          {currentTab === 'indicacoes' && (
            <IndicacoesView user={currentUser} />
          )}

          {currentTab === 'perfil' && (
            <PerfilPlanoView user={currentUser} />
          )}
        </main>

      </div>
    </div>
  );
}

export default App;
