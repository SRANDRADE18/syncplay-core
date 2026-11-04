import React, { useState } from 'react';
import { Users, Calendar, Clock, Copy, Check, CheckCircle2, Gift } from 'lucide-react';

export function IndicacoesView({ user }) {
  const [copied, setCopied] = useState(false);

  const referralCode = user?.referral_code || 'LUNA30';

  const handleCopyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const referrals = [
    {
      id: '1',
      name: 'Rafael Alves',
      initials: 'RA',
      color: 'bg-[#6366f1]',
      date: '18 mai 2025',
      status: 'Confirmado',
      reward: '+30 dias'
    },
    {
      id: '2',
      name: 'Mariana Costa',
      initials: 'MC',
      color: 'bg-[#06b6d4]',
      date: '02 mai 2025',
      status: 'Confirmado',
      reward: '+30 dias'
    },
    {
      id: '3',
      name: 'João Pedro',
      initials: 'JP',
      color: 'bg-[#ec4899]',
      date: '11 abr 2025',
      status: 'Confirmado',
      reward: '+30 dias'
    }
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Top Header & Share Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-gradient-to-r from-[#14172b] to-[#181a30] p-6 md:p-8 rounded-3xl border border-[#212642] shadow-xl">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 text-xs font-bold text-[#c084fc] uppercase tracking-wider">
            <Gift className="w-4 h-4" />
            <span>Programa de Indicações</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white">Indique amigos e ganhe meses grátis</h2>
          <p className="text-xs md:text-sm text-[#94a3b8]">
            Cada amigo que criar uma conta com seu código garante +30 dias de SyncPlay Premium para você.
          </p>
        </div>

        {/* Code Box */}
        <div className="p-4 rounded-2xl bg-[#0d0f1a] border border-dashed border-[#343c5e] flex items-center space-x-4 self-start md:self-auto">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748b] block">Seu código</span>
            <span className="font-mono text-xl font-extrabold text-white tracking-widest">{referralCode}</span>
          </div>
          <button
            onClick={handleCopyCode}
            className="p-3 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6366f1] text-white hover:from-[#6d28d9] hover:to-[#4f46e5] transition-all shadow-md cursor-pointer flex items-center space-x-1.5 text-xs font-semibold"
          >
            {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-white" />}
            <span>{copied ? 'Copiado!' : 'Copiar'}</span>
          </button>
        </div>
      </div>

      {/* Top 3 Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-[#111422] border border-[#1e2338] rounded-2xl p-5 flex items-center space-x-4 shadow-lg">
          <div className="w-12 h-12 rounded-xl bg-[#201830] border border-[#3b2859] flex items-center justify-center text-[#c084fc]">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-[#64748b] tracking-wider uppercase">Amigos indicados</div>
            <div className="text-3xl font-extrabold text-white mt-0.5">3</div>
          </div>
        </div>

        <div className="bg-[#111422] border border-[#1e2338] rounded-2xl p-5 flex items-center space-x-4 shadow-lg">
          <div className="w-12 h-12 rounded-xl bg-[#142338] border border-[#1e3c5f] flex items-center justify-center text-[#38bdf8]">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-[#64748b] tracking-wider uppercase">Dias conquistados</div>
            <div className="text-3xl font-extrabold text-white mt-0.5">90</div>
          </div>
        </div>

        <div className="bg-[#111422] border border-[#1e2338] rounded-2xl p-5 flex items-center space-x-4 shadow-lg">
          <div className="w-12 h-12 rounded-xl bg-[#30162a] border border-[#59224b] flex items-center justify-center text-[#f472b6]">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[11px] font-bold text-[#64748b] tracking-wider uppercase">Próxima renovação</div>
            <div className="text-3xl font-extrabold text-white mt-0.5">14 jun</div>
          </div>
        </div>
      </div>

      {/* Histórico de Indicações */}
      <div className="bg-[#111422] border border-[#1e2338] rounded-2xl p-6 shadow-lg space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Histórico de indicações</h3>
            <p className="text-xs text-[#94a3b8] mt-0.5">Acompanhe quem já entrou com seu código.</p>
          </div>
          <span className="text-[11px] font-bold text-[#64748b] tracking-wider uppercase bg-[#171b2d] px-3 py-1 rounded-md">
            3 indicações
          </span>
        </div>

        {/* List of Referrals */}
        <div className="space-y-3">
          {referrals.map((ref) => (
            <div
              key={ref.id}
              className="flex items-center justify-between p-4 rounded-xl bg-[#0d0f1a] border border-[#1a1f33] hover:border-[#2a314e] transition-colors"
            >
              <div className="flex items-center space-x-3.5">
                <div className={`w-10 h-10 rounded-full ${ref.color} flex items-center justify-center text-white font-bold text-xs shadow-md`}>
                  {ref.initials}
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">{ref.name}</h4>
                  <p className="text-xs text-[#64748b]">{ref.date}</p>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#102422] border border-[#164e3f] text-emerald-400 text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{ref.status}</span>
                </div>
                <span className="text-sm font-bold text-[#a855f7]">{ref.reward}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Como Funciona Stepper */}
      <div className="bg-[#111422] border border-[#1e2338] rounded-2xl p-6 shadow-lg space-y-4">
        <h4 className="text-base font-bold text-white">Como funciona?</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
          
          <div className="flex items-start space-x-3.5">
            <div className="w-8 h-8 rounded-full bg-[#1e2338] text-[#c084fc] flex items-center justify-center font-bold text-xs shrink-0">
              1
            </div>
            <div>
              <h5 className="text-sm font-semibold text-white">Compartilhe seu código</h5>
              <p className="text-xs text-[#94a3b8] mt-1">Envie para quantos amigos quiser pelo WhatsApp, Discord ou direct.</p>
            </div>
          </div>

          <div className="flex items-start space-x-3.5">
            <div className="w-8 h-8 rounded-full bg-[#1e2338] text-[#c084fc] flex items-center justify-center font-bold text-xs shrink-0">
              2
            </div>
            <div>
              <h5 className="text-sm font-semibold text-white">Seu amigo se cadastra</h5>
              <p className="text-xs text-[#94a3b8] mt-1">A conta é totalmente gratuita e rápida de configurar.</p>
            </div>
          </div>

          <div className="flex items-start space-x-3.5">
            <div className="w-8 h-8 rounded-full bg-[#1e2338] text-[#c084fc] flex items-center justify-center font-bold text-xs shrink-0">
              3
            </div>
            <div>
              <h5 className="text-sm font-semibold text-white">Você ganha 30 dias</h5>
              <p className="text-xs text-[#94a3b8] mt-1">O benefício de 30 dias entra na hora na sua conta ativa.</p>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
