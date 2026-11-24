import React, { useEffect, useState } from 'react';
import { Menu, Play, LogOut } from 'lucide-react';
import { socket, updateSocketAuth, API_URL } from './services/socket';
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
    const token = localStorage.getItem('syncplay_token');
    if (saved && token) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [currentTab, setCurrentTab] = useState('inicio');
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [apiOnline, setApiOnline] = useState(true);

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
      videoTitle: 'Vídeo Sincronizado',
      url: ''
    };
  });

  // Verifica conectividade HTTP com a API (especialmente útil em ambiente serverless Vercel)
  useEffect(() => {
    fetch(`${API_URL}`)
      .then((res) => setApiOnline(res.ok))
      .catch(() => setApiOnline(false));
  }, []);

  // Socket connection listeners
  useEffect(() => {
    function onConnect() {
      setIsConnected(true);
      setApiOnline(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    function onRoomCreated(data) {
      setIsCreatingRoom(false);
      if (data.hostToken) {
        sessionStorage.setItem(`hostToken_${data.roomId}`, data.hostToken);
        localStorage.setItem(`syncplay_host_${data.roomId}`, data.hostToken);
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
        isHost: true,
        url: data.videoUrl
      };

      setRooms((prev) => {
        const updated = [newRoom, ...prev.filter((r) => r.id !== data.roomId)];
        localStorage.setItem('syncplay_rooms', JSON.stringify(updated));
        return updated;
      });

      window.history.replaceState({}, '', `/?room=${newRoom.id}`);
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

  // Sincroniza lista de salas persistidas no PostgreSQL via API REST
  useEffect(() => {
    if (!currentUser) return;
    const token = localStorage.getItem('syncplay_token');
    if (!token || token === 'demo_token') return;

    fetch(`${API_URL}/rooms`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then((res) => {
        if (res.ok) {
          setApiOnline(true);
          return res.json();
        }
        return null;
      })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setRooms(data);
          localStorage.setItem('syncplay_rooms', JSON.stringify(data));
        }
      })
      .catch((err) => {
        console.warn('Servidor offline ou sem salas salvas, mantendo cache local:', err);
      });
  }, [currentUser]);

  const handleLoginSuccess = (user, token) => {
    setCurrentUser(user);
    localStorage.setItem('syncplay_user', JSON.stringify(user));
    if (token) {
      updateSocketAuth(token);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setMobileMenuOpen(false);
    localStorage.removeItem('syncplay_user');
    updateSocketAuth(null);
    setActiveRoom(null);
    window.history.replaceState({}, '', '/');
  };

  const handleCreateRoom = async ({ title, video_url }) => {
    setIsCreatingRoom(true);
    const cleanUrl = video_url ? video_url.trim() : 'https://www.youtube.com/watch?v=jfKfPfyJRdk';
    const cleanTitle = title ? title.trim() : 'Nova Sessão SyncPlay';
    const token = localStorage.getItem('syncplay_token');

    // 1. Cria prioritariamente via API REST (persiste no Supabase para celular, PC e Vercel)
    if (token && token !== 'demo_token') {
      try {
        const res = await fetch(`${API_URL}/rooms`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ title: cleanTitle, video_url: cleanUrl }),
        });

        if (res.ok) {
          const data = await res.json();
          const created = data.room;
          setIsCreatingRoom(false);
          setApiOnline(true);

          if (created.hostToken) {
            sessionStorage.setItem(`hostToken_${created.id}`, created.hostToken);
            localStorage.setItem(`syncplay_host_${created.id}`, created.hostToken);
          }

          const newRoom = {
            id: created.id,
            title: created.title || cleanTitle,
            videoTitle: created.title || cleanTitle,
            type: cleanUrl.includes('youtube') || cleanUrl.includes('youtu.be') ? 'YOUTUBE' : 'VÍDEO EXTERNO',
            date: 'Hoje, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            participants: 1,
            image: cleanUrl.includes('youtube') || cleanUrl.includes('youtu.be') ? '/maratona.jpg' : '/horizonte_neon.jpg',
            isPrimary: true,
            url: created.video_url || cleanUrl,
            isHost: true,
          };

          setRooms((prev) => {
            const updated = [newRoom, ...prev.filter((r) => r.id !== newRoom.id)];
            localStorage.setItem('syncplay_rooms', JSON.stringify(updated));
            return updated;
          });

          window.history.replaceState({}, '', `/?room=${newRoom.id}`);
          setActiveRoom(newRoom);
          return;
        }
      } catch (err) {
        console.warn('Falha ao criar sala via REST, tentando Socket/Offline:', err);
      }
    }

    // 2. Fallback via Socket.io se conectado localmente
    if (socket.connected) {
      socket.emit('create_room', { video_url: cleanUrl, roomName: cleanTitle });
      return;
    }

    // 3. Fallback local offline de emergência
    setTimeout(() => {
      setIsCreatingRoom(false);
      const fallbackId = `room-${Date.now()}`;
      sessionStorage.setItem(`hostToken_${fallbackId}`, 'offline_host_token');
      localStorage.setItem(`syncplay_host_${fallbackId}`, 'offline_host_token');

      const demoRoom = {
        id: fallbackId,
        title: cleanTitle,
        videoTitle: cleanTitle,
        type: cleanUrl.includes('youtube') ? 'YOUTUBE' : 'VÍDEO EXTERNO',
        date: 'Hoje, ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        participants: 1,
        image: cleanUrl.includes('youtube') ? '/maratona.jpg' : '/horizonte_neon.jpg',
        isPrimary: true,
        url: cleanUrl,
        isHost: true
      };
      setRooms((prev) => {
        const updated = [demoRoom, ...prev];
        localStorage.setItem('syncplay_rooms', JSON.stringify(updated));
        return updated;
      });
      window.history.replaceState({}, '', `/?room=${demoRoom.id}`);
      setActiveRoom(demoRoom);
    }, 300);
  };

  const handleDeleteRoom = (roomId) => {
    setRooms((prev) => {
      const updated = prev.filter((r) => r.id !== roomId);
      localStorage.setItem('syncplay_rooms', JSON.stringify(updated));
      return updated;
    });

    const token = localStorage.getItem('syncplay_token');
    if (token && token !== 'demo_token') {
      fetch(`${API_URL}/rooms/${roomId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      }).catch((err) => {
        console.warn('Erro ao excluir sala no backend:', err);
      });
    }

    if (socket.connected) {
      socket.emit('delete_room', { roomId });
    }

    if (activeRoom && activeRoom.id === roomId) {
      setActiveRoom(null);
      window.history.replaceState({}, '', '/');
    }
  };

  const handleOpenRoom = (roomId, title, url, videoTitle) => {
    const existing = rooms.find((r) => r.id === roomId);
    window.history.replaceState({}, '', `/?room=${roomId}`);
    setActiveRoom({
      id: roomId,
      title: title || existing?.title || 'Sessão SyncPlay',
      videoTitle: videoTitle || existing?.videoTitle || 'Vídeo Sincronizado',
      url: url || existing?.url || '',
      isHost: Boolean(existing?.isHost || localStorage.getItem(`syncplay_host_${roomId}`)),
    });
  };

  const handleLeaveRoom = () => {
    if (activeRoom?.id) {
      const token = localStorage.getItem('syncplay_token');
      if (token && token !== 'demo_token') {
        fetch(`${API_URL}/rooms/${activeRoom.id}/leave`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    }
    window.history.replaceState({}, '', '/');
    setActiveRoom(null);
  };

  // Se não estiver logado, exibe a AuthScreen
  if (!currentUser) {
    return <AuthScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // Se estiver dentro de uma sala de vídeo ativa
  if (activeRoom) {
    return (
      <div className="min-h-[100dvh] bg-[#0b0d14] text-white">
        <Room
          roomId={activeRoom.id}
          roomTitle={activeRoom.title}
          defaultVideoTitle={activeRoom.videoTitle}
          initialVideoUrl={activeRoom.url}
          onLeave={handleLeaveRoom}
          user={currentUser}
          initialIsHost={Boolean(activeRoom.isHost)}
        />
      </div>
    );
  }

  const isServiceOnline = isConnected || apiOnline;
  const userInitials =
    currentUser?.initials || (currentUser?.name ? currentUser.name.substring(0, 2).toUpperCase() : 'U');

  return (
    <div className="min-h-[100dvh] bg-[#0b0d14] text-white flex flex-col md:flex-row">
      {/* Navegação Responsiva: Sidebar no Desktop + Drawer & Bottom Nav no Celular */}
      <Sidebar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        user={currentUser}
        onLogout={handleLogout}
        onOpenCreateRoom={() => setCurrentTab('criar_sala')}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobileMenu={() => setMobileMenuOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Navbar Responsiva */}
        <header className="h-14 md:h-16 border-b border-[#1a1e30] bg-[#0d101a]/90 backdrop-blur-md px-4 md:px-8 flex items-center justify-between sticky top-0 z-20 pt-safe">
          {/* Mobile Left: Menu + Brand */}
          <div className="flex md:hidden items-center space-x-2.5">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-1 rounded-xl text-[#94a3b8] hover:text-white active:bg-[#171b2d]"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div
              onClick={() => setCurrentTab('inicio')}
              className="flex items-center space-x-2 cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#6366f1] to-[#a855f7] flex items-center justify-center shadow-[0_0_12px_rgba(168,85,247,0.5)]">
                <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
              </div>
              <span className="text-base font-extrabold tracking-tight text-white">
                Sync<span className="text-[#a855f7]">Play</span>
              </span>
            </div>
          </div>

          {/* Desktop Left: Breadcrumb */}
          <div className="hidden md:flex items-center space-x-3 text-xs text-[#94a3b8]">
            <span className="font-semibold text-white">SyncPlay</span>
            <span>/</span>
            <span className="capitalize text-[#c084fc] font-medium">
              {currentTab.replace('_', ' ')}
            </span>
          </div>

          <div className="flex items-center space-x-2.5 sm:space-x-4">
            {/* Connection Status Badge */}
            <div className="flex items-center space-x-1.5 sm:space-x-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-[#131625] border border-[#1e2338]">
              <span className={`w-2 h-2 rounded-full ${isServiceOnline ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-amber-400'}`}></span>
              <span className="text-[10px] sm:text-[11px] font-mono text-[#94a3b8] tracking-wider uppercase">
                {isServiceOnline ? 'ONLINE' : 'OFFLINE'}
              </span>
            </div>

            {/* Mobile Avatar Shortcut */}
            <button
              onClick={() => setCurrentTab('perfil')}
              className="md:hidden w-8 h-8 rounded-full bg-gradient-to-tr from-[#6366f1] to-[#a855f7] flex items-center justify-center text-white font-bold text-xs shadow"
              aria-label="Perfil"
            >
              {userInitials}
            </button>

            {/* Desktop Logout Shortcut */}
            <button
              onClick={handleLogout}
              className="hidden md:inline-flex items-center space-x-1.5 text-xs font-medium text-[#94a3b8] hover:text-rose-400 px-3 py-1.5 rounded-lg border border-[#1e2338] hover:border-rose-500/30 transition-colors cursor-pointer"
              title="Sair da conta"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sair</span>
            </button>
          </div>
        </header>

        {/* Dynamic Page Views (pb-24 no celular para respeitar a barra inferior fixa) */}
        <main className="flex-1 p-4 sm:p-6 md:p-10 pb-24 md:pb-10 max-w-7xl w-full mx-auto">
          {currentTab === 'inicio' && (
            <DashboardView
              user={currentUser}
              roomsCount={rooms.length}
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
            <PerfilPlanoView user={currentUser} onLogout={handleLogout} />
          )}
        </main>

      </div>
    </div>
  );
}

export default App;
