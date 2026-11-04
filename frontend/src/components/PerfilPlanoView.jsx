import React from 'react';
import { Lock, Check, ChevronRight, Calendar, CheckCircle2 } from 'lucide-react';

export function PerfilPlanoView({ user }) {
  return (
    <div className="max-w-4xl space-y-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Perfil e plano</h2>
        <p className="text-xs md:text-sm text-[#94a3b8] mt-1">
          Gerencie sua assinatura, segurança da conta e histórico de pagamentos.
        </p>
      </div>

      {/* Main Plan Card & Features */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left: Plan Details Card */}
        <div className="lg:col-span-7 bg-[#111422] border border-[#1e2338] rounded-2xl p-6 md:p-8 shadow-lg flex flex-col justify-between space-y-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#a855f7] block mb-0.5">Plano Atual</span>
                <h3 className="text-2xl font-extrabold text-white">{user?.plan || 'Plano Vibe'}</h3>
              </div>
              <span className="px-3 py-1 rounded-full bg-[#102422] border border-[#164e3f] text-emerald-400 text-xs font-semibold">
                Ativo
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#1a1f33]">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] block">Próxima renovação</span>
                <span className="text-sm font-semibold text-white">14 de junho de 2025</span>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] block">Valor</span>
                <span className="text-sm font-semibold text-white">R$ 14,90/mês</span>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2 pt-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-white font-medium">{user?.daysLeft || 23} dias restantes</span>
                <span className="text-[#a855f7] font-semibold">74%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-[#1a1f33] overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#7c3aed] to-[#a855f7] rounded-full w-[74%] shadow-[0_0_10px_#a855f7]"></div>
              </div>
            </div>
          </div>

          <button
            onClick={() => alert('Painel de gestão de assinatura Stripe/MercadoPago.')}
            className="w-full py-3 px-4 rounded-xl font-bold text-xs md:text-sm text-white bg-[#1a1f33] hover:bg-[#252b47] border border-[#2b3352] transition-colors cursor-pointer"
          >
            Gerenciar assinatura
          </button>
        </div>

        {/* Right: Plan Benefits Checklist */}
        <div className="lg:col-span-5 bg-[#111422] border border-[#1e2338] rounded-2xl p-6 md:p-8 shadow-lg flex flex-col justify-center space-y-4">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider text-[#64748b]">Benefícios Inclusos</h4>
          <ul className="space-y-3.5 text-sm text-[#94a3b8]">
            <li className="flex items-center space-x-3">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-white font-medium">Salas ilimitadas</span>
            </li>
            <li className="flex items-center space-x-3">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-white font-medium">Convidados sempre grátis</span>
            </li>
            <li className="flex items-center space-x-3">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-white font-medium">Sincronização em tempo real</span>
            </li>
            <li className="flex items-center space-x-3">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="text-white font-medium">Qualidade até 4K sem compressão</span>
            </li>
          </ul>
        </div>

      </div>

      {/* Segurança Card */}
      <div className="bg-[#111422] border border-[#1e2338] rounded-2xl p-6 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 rounded-xl bg-[#201830] border border-[#3b2859] flex items-center justify-center text-[#c084fc] shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-base font-bold text-white">Segurança</h4>
            <p className="text-xs text-[#94a3b8] mt-0.5">Mantenha sua conta protegida com senha forte.</p>
          </div>
        </div>

        <button
          onClick={() => {
            const nova = prompt('Digite sua nova senha:');
            if (nova) alert('Senha atualizada com sucesso!');
          }}
          className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-[#171a2b] hover:bg-[#20253d] border border-[#232942] text-xs font-semibold text-white transition-colors cursor-pointer self-start sm:self-auto"
        >
          <span>Alterar senha</span>
          <ChevronRight className="w-4 h-4 text-[#64748b]" />
        </button>
      </div>

      {/* Histórico de Pagamentos */}
      <div className="bg-[#111422] border border-[#1e2338] rounded-2xl p-6 shadow-lg space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-base font-bold text-white">Histórico de pagamentos</h4>
            <p className="text-xs text-[#94a3b8] mt-0.5">Seus últimos lançamentos e faturas.</p>
          </div>
          <button className="text-xs font-semibold text-[#64748b] hover:text-white transition-colors">
            Ver todos
          </button>
        </div>

        <div className="p-4 rounded-xl bg-[#0d0f1a] border border-[#1a1f33] flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-[#1a1f33] flex items-center justify-center text-[#94a3b8]">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h5 className="text-sm font-semibold text-white">Plano Vibe — Mensal</h5>
              <p className="text-xs text-[#64748b]">14 de maio de 2025</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-sm font-bold text-white">R$ 14,90</span>
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#102422] border border-[#164e3f] text-emerald-400 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Pago</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
