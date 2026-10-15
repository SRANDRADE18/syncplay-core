import React from 'react';
import { Home, Plus, Users, Gift, User, LogOut, Play } from 'lucide-react';

export function Sidebar({ currentTab, setCurrentTab, user, onLogout, onOpenCreateRoom }) {
  const navItems = [
    { id: 'inicio', label: 'Início', icon: Home },
    { id: 'criar_sala', label: 'Criar sala', icon: Plus, isAction: true },
    { id: 'minhas_salas', label: 'Minhas salas', icon: Users },
    { id: 'indicacoes', label: 'Indicações', icon: Gift },
    { id: 'perfil', label: 'Perfil e plano', icon: User },
  ];

  const handleNavClick = (item) => {
    if (item.isAction) {
      if (onOpenCreateRoom) {
        onOpenCreateRoom();
      } else {
        setCurrentTab('criar_sala');
      }
    } else {
      setCurrentTab(item.id);
    }
  };

  return (
    <aside className="w-64 bg-[#0d101a] border-r border-[#1a1e30] flex flex-col justify-between h-screen sticky top-0 shrink-0 select-none z-30">
      {/* Top Section: Brand Logo */}
      <div className="p-6">
        <div 
          onClick={() => setCurrentTab('inicio')}
          className="flex items-center space-x-3 cursor-pointer group mb-8"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#6366f1] to-[#a855f7] flex items-center justify-center shadow-[0_0_20px_rgba(139,92,246,0.5)] group-hover:shadow-[0_0_25px_rgba(168,85,247,0.7)] transition-all">
            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white flex items-center">
            Sync<span className="text-[#a855f7]">Play</span>
          </span>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                  isActive
                    ? 'bg-[#1b1f32] text-white shadow-inner border border-[#2b3252]'
                    : 'text-[#94a3b8] hover:text-white hover:bg-[#141828]'
                }`}
              >
                <div className="flex items-center space-x-3.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-[#a855f7]' : 'text-[#64748b]'}`} />
                  <span>{item.label}</span>
                </div>
                {item.id === 'criar_sala' && (
                  <span className="w-5 h-5 rounded-full bg-[#1e2238] flex items-center justify-center text-xs text-[#a855f7] font-bold">
                    +
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Profile Section */}
      <div className="p-4 border-t border-[#1a1e30] space-y-3">
        <div className="flex items-center space-x-3 p-2 rounded-xl bg-[#131625] border border-[#1e2338]">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#6366f1] to-[#a855f7] flex items-center justify-center text-white font-bold text-sm shadow-md">
            {user?.initials || 'LM'}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-white truncate">{user?.name || 'Luna Martins'}</h4>
            <p className="text-xs text-[#a855f7] font-medium">{user?.plan || 'Plano Vibe'}</p>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center space-x-3 px-3 py-2 text-xs font-semibold text-[#64748b] hover:text-rose-400 hover:bg-[#1a121d] rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Sair</span>
        </button>
      </div>
    </aside>
  );
}
