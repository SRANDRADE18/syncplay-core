import React, { useState } from 'react';
import { Plus, Clock, Users, Gift, Copy, Check, Play, Shield, ArrowRight } from 'lucide-react';

export function DashboardView({ user, onOpenCreateRoom, onOpenRoom, onNavigateTab }) {
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(user?.referral_code || 'SYNCPLAY');
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Active Subscription Hero Banner */}
      <div className="relative rounded-3xl bg-gradient-to-r from-[#14172a] via-[#161a30] to-[#1a1733] border border-[#232945] p-8 md:p-10 overflow-hidden shadow-2xl">
        {/* Ambient subtle glow background */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 rounded-full blur-[90px] pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
          <div className="space-y-4 max-w-xl">
            {/* Subscription active badge */}
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#102422] border border-[#164e3f] text-emerald-400 text-xs font-semibold tracking-wider uppercase">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]"></span>
              <span>Assinatura Ativa</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Continue criando momentos juntos.
            </h2>

            <p className="text-[#94a3b8] text-sm md:text-base">
              Seu plano Vibe está ativo por mais <strong className="text-white font-bold">{user?.daysLeft || 23} dias</strong>.
            </p>

            <div className="pt-2">
              <button
                onClick={onOpenCreateRoom}
                className="inline-flex items-center space-x-2.5 px-6 py-3.5 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#7c3aed] to-[#6366f1] hover:from-[#6d28d9] hover:to-[#4f46e5] shadow-[0_0_25px_rgba(124,58,237,0.4)] hover:shadow-[0_0_35px_rgba(124,58,237,0.6)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Criar nova sala</span>
              </button>
            </div>
          </div>

          {/* Right Glowing Orbital Play graphic */}
          <div className="relative flex items-center justify-center self-center md:self-auto shrink-0 w-44 h-44">
            {/* Concentric rings */}
            <div className="absolute inset-0 rounded-full border border-purple-500/15 animate-[spin_20s_linear_infinite]"></div>
            <div className="absolute inset-3 rounded-full border border-dashed border-indigo-500/20"></div>
            <div className="absolute inset-7 rounded-full border border-purple-400/25"></div>

            {/* Central Glowing Play Button */}
            <div 
              onClick={onOpenCreateRoom}
              className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#6366f1] to-[#a855f7] flex items-center justify-center cursor-pointer shadow-[0_0_35px_rgba(168,85,247,0.8)] hover:scale-105 transition-transform"
            >
              <Play className="w-8 h-8 text-white fill-white ml-1" />
            </div>
          </div>
        </div>
      </div>

      {/* Visão Geral Section */}
      <div className="space-y-4">
        <div>
          <h3 className="text-xl font-bold text-white">Visão geral</h3>
          <p className="text-xs text-[#64748b]">Tudo certo por aqui.</p>
        </div>

        {/* 3 Metric Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Metric 1 */}
          <div className="bg-[#111422] border border-[#1e2338] rounded-2xl p-5 flex items-start space-x-4 shadow-lg hover:border-[#2a314e] transition-colors">
            <div className="w-12 h-12 rounded-xl bg-[#201830] border border-[#3b2859] flex items-center justify-center text-[#c084fc] shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-[#64748b] tracking-wider uppercase">Dias restantes</div>
              <div className="text-3xl font-extrabold text-white mt-0.5">{user?.daysLeft || 23}</div>
              <div className="text-xs text-[#64748b] mt-1">Expira em 14 jun 2025</div>
            </div>
          </div>

          {/* Metric 2 */}
          <div className="bg-[#111422] border border-[#1e2338] rounded-2xl p-5 flex items-start space-x-4 shadow-lg hover:border-[#2a314e] transition-colors">
            <div className="w-12 h-12 rounded-xl bg-[#142338] border border-[#1e3c5f] flex items-center justify-center text-[#38bdf8] shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-[#64748b] tracking-wider uppercase">Sessões criadas</div>
              <div className="text-3xl font-extrabold text-white mt-0.5">{user?.sessionsCount || 12}</div>
              <div className="text-xs text-[#64748b] mt-1">4 neste mês</div>
            </div>
          </div>

          {/* Metric 3 */}
          <div className="bg-[#111422] border border-[#1e2338] rounded-2xl p-5 flex items-start space-x-4 shadow-lg hover:border-[#2a314e] transition-colors">
            <div className="w-12 h-12 rounded-xl bg-[#30162a] border border-[#59224b] flex items-center justify-center text-[#f472b6] shrink-0">
              <Gift className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-[#64748b] tracking-wider uppercase">Amigos indicados</div>
              <div className="text-3xl font-extrabold text-white mt-0.5">{user?.referralsCount || 3}</div>
              <div className="text-xs text-emerald-400 font-medium mt-1">+90 dias conquistados</div>
            </div>
          </div>
        </div>
      </div>

      {/* Lower Row: Referral Code Box & Last Session */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Convide e ganhe */}
        <div className="lg:col-span-5 bg-[#111422] border border-[#1e2338] rounded-2xl p-6 flex flex-col justify-between shadow-lg">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#201830] flex items-center justify-center text-[#c084fc]">
                <Gift className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Convide e ganhe</h4>
                <p className="text-xs text-[#94a3b8]">30 dias grátis por amigo</p>
              </div>
            </div>

            {/* Code Box */}
            <div className="mt-5 p-3 rounded-xl bg-[#0d0f1a] border border-dashed border-[#2d3552] flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider text-[#64748b] font-bold block">Seu código</span>
                <span className="font-mono text-lg font-bold text-white tracking-widest">{user?.referral_code || 'SYNCPLAY'}</span>
              </div>
              <button
                onClick={handleCopyCode}
                className="p-2.5 rounded-lg bg-[#1a1f33] hover:bg-[#252b47] text-[#94a3b8] hover:text-white transition-colors"
                title="Copiar código"
              >
                {copiedCode ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-6">
            <button
              onClick={() => onNavigateTab('indicacoes')}
              className="text-xs font-semibold text-[#a855f7] hover:text-[#c084fc] inline-flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <span>Ver minhas indicações</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Sua última sessão */}
        <div className="lg:col-span-7 bg-[#111422] border border-[#1e2338] rounded-2xl p-6 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-base font-bold text-white">Sua última sessão</h4>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] bg-[#171b2d] px-2.5 py-1 rounded-md">
                Há 2 dias
              </span>
            </div>
            <p className="text-xs text-[#94a3b8] mb-4">Continue de onde parou</p>

            {/* Mini Player / Session Card */}
            <div className="flex flex-col sm:flex-row items-center gap-4 p-3 rounded-xl bg-[#0d0f1a] border border-[#1e2338]">
              <div className="relative w-full sm:w-36 h-20 rounded-lg overflow-hidden shrink-0 group">
                <img 
                  src="/horizonte_neon.jpg" 
                  alt="Horizonte Neon" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform" 
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Play className="w-3.5 h-3.5 text-white fill-white ml-0.5" />
                  </div>
                </div>
              </div>

              <div className="flex-1 w-full space-y-1">
                <span className="text-[10px] font-bold text-[#38bdf8] uppercase tracking-wider block">Vídeo Externo</span>
                <h5 className="text-sm font-bold text-white">Horizonte Neon</h5>
                <p className="text-xs text-[#64748b]">com Rafael, Mari e +2</p>

                <div className="pt-1">
                  <button
                    onClick={() => onOpenRoom('noite-de-ficcao-cientifica', 'Noite de ficção científica', 'https://www.w3schools.com/html/mov_bbb.mp4', 'Horizonte Neon')}
                    className="text-xs font-semibold text-[#a855f7] hover:text-[#c084fc] inline-flex items-center space-x-1 transition-colors cursor-pointer"
                  >
                    <span>Abrir sala novamente</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Legal Footer Notice */}
      <div className="pt-6 pb-2 text-center text-xs text-[#64748b] flex items-center justify-center space-x-2">
        <Shield className="w-4 h-4 text-[#475569]" />
        <span>O SyncPlay não hospeda conteúdo. Conectamos você aos serviços de mídia que já utiliza.</span>
      </div>

    </div>
  );
}
