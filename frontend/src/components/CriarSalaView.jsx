import React, { useState } from 'react';
import { Link2, Shield, ArrowRight, Play, CheckCircle2 } from 'lucide-react';

export function CriarSalaView({ onCreateRoom, isCreating }) {
  const [roomName, setRoomName] = useState('Noite de ficção científica');
  const [videoUrl, setVideoUrl] = useState('https://www.w3schools.com/html/mov_bbb.mp4');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!roomName.trim()) return;
    onCreateRoom({
      title: roomName.trim(),
      video_url: videoUrl.trim() || 'https://www.w3schools.com/html/mov_bbb.mp4'
    });
  };

  // Detect provider dynamically
  const getProviderInfo = () => {
    const url = videoUrl.toLowerCase();
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return { name: 'YouTube', color: 'bg-red-600', text: 'YouTube Player Integrado' };
    }
    if (url.includes('vimeo.com')) {
      return { name: 'Vimeo', color: 'bg-blue-500', text: 'Vimeo Player Integrado' };
    }
    if (url.includes('twitch.tv')) {
      return { name: 'Twitch', color: 'bg-purple-600', text: 'Twitch Stream Integrado' };
    }
    return { name: 'Vídeo Externo / MP4', color: 'bg-rose-500', text: 'Compatível com diferentes provedores de mídia externos.' };
  };

  const provider = getProviderInfo();

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-300">
      
      <div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Criar nova sala</h2>
        <p className="text-xs md:text-sm text-[#94a3b8] mt-1">
          Prepare o ambiente perfeito para assistir sincronizado com seus amigos.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* Nome da sala */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-sm font-bold text-white">Nome da sala</label>
            <span className="text-xs text-[#64748b] font-mono">{roomName.length}/50</span>
          </div>
          <p className="text-xs text-[#94a3b8]">Dê um nome que seus amigos vão reconhecer.</p>
          <input
            type="text"
            required
            maxLength={50}
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="Ex: Noite de ficção científica"
            className="w-full bg-[#111422] border border-[#1e2338] rounded-xl px-4 py-3.5 text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#a855f7] focus:ring-1 focus:ring-[#a855f7] transition-all font-medium"
          />
        </div>

        {/* Link do conteúdo */}
        <div className="space-y-2">
          <label className="text-sm font-bold text-white">Link do conteúdo</label>
          <p className="text-xs text-[#94a3b8]">Cole o link do filme, série ou vídeo no serviço de sua escolha.</p>
          <div className="relative">
            <Link2 className="w-4 h-4 text-[#64748b] absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="url"
              required
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://servico-de-video.com/..."
              className="w-full bg-[#111422] border border-[#1e2338] rounded-xl pl-11 pr-4 py-3.5 text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#a855f7] focus:ring-1 focus:ring-[#a855f7] transition-all font-medium"
            />
          </div>

          {/* Quick presets for testing */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] text-[#64748b]">Sugestões rápidas:</span>
            <button
              type="button"
              onClick={() => { setVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'); if (roomName === 'Noite de ficção científica') setRoomName('Sessão YouTube'); }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-[#1a1f33] hover:bg-[#252b47] text-[#c084fc] font-semibold border border-[#2b3352] transition-colors cursor-pointer"
            >
              YouTube Clip
            </button>
            <button
              type="button"
              onClick={() => { setVideoUrl('https://www.youtube.com/watch?v=jfKfPfyJRdk'); if (roomName === 'Noite de ficção científica') setRoomName('Lofi Radio'); }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-[#1a1f33] hover:bg-[#252b47] text-[#38bdf8] font-semibold border border-[#2b3352] transition-colors cursor-pointer"
            >
              Lofi Girl (Ao Vivo)
            </button>
            <button
              type="button"
              onClick={() => setVideoUrl('https://www.w3schools.com/html/mov_bbb.mp4')}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-[#1a1f33] hover:bg-[#252b47] text-[#94a3b8] hover:text-white border border-[#2b3352] transition-colors cursor-pointer"
            >
              Vídeo MP4 Demo
            </button>
          </div>
        </div>

        {/* Auto-detected Integration Card */}
        <div className="p-4 rounded-xl bg-[#111422] border border-[#1e2338] flex items-center space-x-4">
          <div className={`w-10 h-10 rounded-xl ${provider.color} flex items-center justify-center shrink-0 shadow-md`}>
            <Play className="w-5 h-5 text-white fill-white ml-0.5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white flex items-center space-x-1.5">
              <span>Integração detectada automaticamente</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </h4>
            <p className="text-xs text-[#94a3b8] mt-0.5">
              {provider.text}
            </p>
          </div>
        </div>

        {/* Security Reassurance Box */}
        <div className="p-4 rounded-xl bg-[#101320] border border-[#1a1f33] flex items-start space-x-3.5">
          <Shield className="w-5 h-5 text-[#a855f7] shrink-0 mt-0.5" />
          <div className="text-xs text-[#94a3b8] leading-relaxed">
            <strong className="text-white font-semibold block mb-0.5">Você mantém o controle.</strong>
            O SyncPlay sincroniza a reprodução, mas não armazena nem distribui qualquer conteúdo.
          </div>
        </div>

        {/* Submit CTA */}
        <button
          type="submit"
          disabled={isCreating}
          className="w-full py-4 px-6 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-[#7c3aed] to-[#6366f1] hover:from-[#6d28d9] hover:to-[#4f46e5] shadow-[0_0_25px_rgba(124,58,237,0.4)] hover:shadow-[0_0_35px_rgba(124,58,237,0.6)] flex items-center justify-center space-x-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer disabled:opacity-50"
        >
          {isCreating ? (
            <span className="flex items-center space-x-2">
              <span className="inline-block animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></span>
              <span>Criando sala...</span>
            </span>
          ) : (
            <>
              <ArrowRight className="w-4 h-4" />
              <span>Continuar para convite</span>
            </>
          )}
        </button>

      </form>

    </div>
  );
}
