import React, { useState } from 'react';
import { X, Copy, Check, Share2, Users, MessageCircle } from 'lucide-react';

export function InviteModal({ isOpen, onClose, roomId, roomTitle }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const roomLink = `${window.location.origin}/?room=${roomId}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(roomLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = () => {
    const text = encodeURIComponent(`Bora assistir "${roomTitle || 'uma sessão'}" comigo no SyncPlay! Entra aí: ${roomLink}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#111422] border-t sm:border border-[#232945] rounded-t-3xl sm:rounded-3xl p-5 sm:p-8 max-w-md w-full shadow-2xl relative space-y-5 pb-safe">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 p-2 rounded-xl text-[#64748b] hover:text-white hover:bg-[#1a1f33] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="space-y-1">
          <div className="w-10 h-10 rounded-xl bg-[#201830] text-[#c084fc] flex items-center justify-center mb-3">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-xl font-bold text-white">Convidar amigos</h3>
          <p className="text-xs text-[#94a3b8]">
            Compartilhe o link da sala <strong className="text-white">"{roomTitle || 'Noite de ficção científica'}"</strong> para assistirem juntos.
          </p>
        </div>

        {/* Link Field with Copy */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#94a3b8]">Link direto da sala</label>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              readOnly
              value={roomLink}
              className="flex-1 bg-[#0d0f1a] border border-[#1e2338] rounded-xl px-4 py-3 text-xs text-[#94a3b8] font-mono select-all focus:outline-none"
            />
            <button
              onClick={handleCopy}
              className="py-3 px-4 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-[#7c3aed] to-[#6366f1] hover:from-[#6d28d9] hover:to-[#4f46e5] flex items-center space-x-1.5 transition-all shadow-md shrink-0 cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              <span>{copied ? 'Copiado!' : 'Copiar'}</span>
            </button>
          </div>
        </div>

        {/* Share shortcuts */}
        <div className="pt-2 border-t border-[#1a1f33]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748b] block mb-3">
            Compartilhar via
          </span>
          <div className="flex gap-3">
            <button
              onClick={shareWhatsApp}
              className="flex-1 py-2.5 px-3 rounded-xl bg-[#15231c] hover:bg-[#1a3026] border border-[#1d4633] text-emerald-400 text-xs font-semibold flex items-center justify-center space-x-2 transition-colors cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>
            <button
              onClick={() => {
                if (navigator.share) {
                  navigator.share({ title: 'SyncPlay', url: roomLink });
                } else {
                  handleCopy();
                }
              }}
              className="flex-1 py-2.5 px-3 rounded-xl bg-[#1b1f33] hover:bg-[#252b47] border border-[#2b3352] text-white text-xs font-semibold flex items-center justify-center space-x-2 transition-colors cursor-pointer"
            >
              <Share2 className="w-4 h-4 text-[#a855f7]" />
              <span>Outros</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
