import React from 'react';
import { Home, Plus, Users, Gift, User, LogOut, Play, X } from 'lucide-react';

export function Sidebar({
  currentTab,
  setCurrentTab,
  user,
  onLogout,
  onOpenCreateRoom,
  mobileMenuOpen = false,
  onCloseMobileMenu,
}) {
  const navItems = [
    { id: 'inicio', label: 'Início', shortLabel: 'Início', icon: Home },
    { id: 'criar_sala', label: 'Criar sala', shortLabel: 'Criar', icon: Plus, isAction: true },
    { id: 'minhas_salas', label: 'Minhas salas', shortLabel: 'Salas', icon: Users },
    { id: 'indicacoes', label: 'Indicações', shortLabel: 'Indicar', icon: Gift },
    { id: 'perfil', label: 'Perfil e plano', shortLabel: 'Perfil', icon: User },
  ];

  const bottomNavOrder = [
    navItems[0], // Início
    navItems[2], // Salas
    navItems[1], // + Criar (central em destaque)
    navItems[3], // Indicar
    navItems[4], // Perfil
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
    if (onCloseMobileMenu) {
      onCloseMobileMenu();
    }
  };

  const userInitials =
    user?.initials || (user?.name ? user.name.substring(0, 2).toUpperCase() : 'U');

  return (
    <>
      {/* DESKTOP SIDEBAR (md e acima) */}
      <aside className="hidden md:flex w-64 bg-[#0d101a] border-r border-[#1a1e30] flex-col justify-between h-screen sticky top-0 shrink-0 select-none z-30">
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
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 cursor-pointer ${
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
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#6366f1] to-[#a855f7] flex items-center justify-center text-white font-bold text-sm shadow-md shrink-0">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-white truncate">{user?.name || 'Usuário'}</h4>
              <p className="text-xs text-[#a855f7] font-medium">{user?.plan || 'Plano Vibe'}</p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center space-x-3 px-3 py-2 text-xs font-semibold text-[#64748b] hover:text-rose-400 hover:bg-[#1a121d] rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* MOBILE SLIDE-OVER DRAWER */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm"
            onClick={onCloseMobileMenu}
          />
          <aside className="relative w-72 max-w-[82vw] bg-[#0d101a] border-r border-[#1a1e30] flex flex-col justify-between h-full z-10 p-5 animate-in slide-in-from-left duration-200">
            <div>
              <div className="flex items-center justify-between mb-6">
                <div
                  onClick={() => handleNavClick(navItems[0])}
                  className="flex items-center space-x-2.5 cursor-pointer"
                >
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#6366f1] to-[#a855f7] flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.5)]">
                    <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                  </div>
                  <span className="text-xl font-bold tracking-tight text-white">
                    Sync<span className="text-[#a855f7]">Play</span>
                  </span>
                </div>
                <button
                  onClick={onCloseMobileMenu}
                  className="p-2 rounded-xl text-[#94a3b8] hover:text-white bg-[#141828]"
                  aria-label="Fechar menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="space-y-1.5">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item)}
                      className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl font-medium text-sm transition-all ${
                        isActive
                          ? 'bg-[#1b1f32] text-white border border-[#2b3252]'
                          : 'text-[#94a3b8] active:bg-[#141828]'
                      }`}
                    >
                      <div className="flex items-center space-x-3.5">
                        <Icon className={`w-4 h-4 ${isActive ? 'text-[#a855f7]' : 'text-[#64748b]'}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.id === 'criar_sala' && (
                        <span className="w-5 h-5 rounded-full bg-[#7c3aed]/25 flex items-center justify-center text-xs text-[#c084fc] font-bold">
                          +
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-[#1a1e30] space-y-3 pb-safe">
              <div className="flex items-center space-x-3 p-2.5 rounded-xl bg-[#131625] border border-[#1e2338]">
                <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#6366f1] to-[#a855f7] flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {userInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-white truncate">{user?.name || 'Usuário'}</h4>
                  <p className="text-xs text-[#64748b] truncate">{user?.email || user?.plan || 'Plano Vibe'}</p>
                </div>
              </div>

              <button
                onClick={() => {
                  if (onCloseMobileMenu) onCloseMobileMenu();
                  onLogout();
                }}
                className="w-full flex items-center justify-center space-x-2 px-4 py-3 text-xs font-bold text-rose-400 bg-rose-500/10 border border-rose-500/25 rounded-xl active:scale-98 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair da conta</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-[#0d101a]/95 backdrop-blur-xl border-t border-[#1a1e30] pb-safe select-none">
        <div className="grid grid-cols-5 items-center h-16 px-1">
          {bottomNavOrder.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;

            if (item.isAction) {
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item)}
                  className="flex flex-col items-center justify-center -mt-4"
                  aria-label="Criar nova sala"
                >
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(124,58,237,0.55)] transition-transform active:scale-95 ${
                      isActive
                        ? 'bg-gradient-to-tr from-[#a855f7] to-[#6366f1] ring-2 ring-purple-300/60'
                        : 'bg-gradient-to-tr from-[#7c3aed] to-[#6366f1]'
                    }`}
                  >
                    <Plus className="w-6 h-6 text-white stroke-[2.75]" />
                  </div>
                  <span className="text-[10px] font-bold text-[#c084fc] mt-1">Criar</span>
                </button>
              );
            }

            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item)}
                className={`flex flex-col items-center justify-center py-1.5 space-y-1 transition-colors ${
                  isActive ? 'text-[#c084fc]' : 'text-[#64748b] active:text-white'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-[#a855f7]' : 'text-[#64748b]'}`} />
                <span className={`text-[10px] ${isActive ? 'font-bold text-white' : 'font-medium'}`}>
                  {item.shortLabel}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
