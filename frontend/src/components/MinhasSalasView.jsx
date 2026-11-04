import React, { useState } from 'react';
import { Trash2, ArrowRight, Clock, Users, Plus, AlertCircle, Play, Check } from 'lucide-react';

export function MinhasSalasView({ rooms, onDeleteRoom, onOpenRoom, onOpenCreateRoom }) {
  const [deletedToast, setDeletedToast] = useState('');

  const handleDelete = (id, title, e) => {
    e.stopPropagation();
    onDeleteRoom(id);
    setDeletedToast(`Sala "${title}" removida.`);
    setTimeout(() => setDeletedToast(''), 3000);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Toast Notification */}
      {deletedToast && (
        <div className="fixed top-20 right-8 z-50 bg-[#161a2b] border border-emerald-500/40 text-emerald-300 text-xs font-semibold px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-2 animate-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{deletedToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Minhas salas</h2>
          <p className="text-xs md:text-sm text-[#94a3b8] mt-1">
            Gerencie suas salas ativas, acesse sessões anteriores e compartilhe com amigos.
          </p>
        </div>

        <button
          onClick={onOpenCreateRoom}
          className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl font-bold text-xs md:text-sm text-white bg-gradient-to-r from-[#7c3aed] to-[#6366f1] hover:from-[#6d28d9] hover:to-[#4f46e5] shadow-[0_0_20px_rgba(124,58,237,0.3)] transition-all transform hover:-translate-y-0.5 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Nova sala</span>
        </button>
      </div>

      {/* Empty State */}
      {(!rooms || rooms.length === 0) ? (
        <div className="p-12 text-center bg-[#111422] border border-[#1e2338] rounded-3xl space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-[#1d1930] text-[#a855f7] flex items-center justify-center mx-auto">
            <Play className="w-8 h-8 ml-1 fill-[#a855f7]" />
          </div>
          <h3 className="text-xl font-bold text-white">Nenhuma sala encontrada</h3>
          <p className="text-xs text-[#94a3b8] max-w-sm mx-auto">
            Você ainda não criou nenhuma sala ou todas as salas foram excluídas. Crie uma nova sala para assistir vídeos sincronizados!
          </p>
          <button
            onClick={onOpenCreateRoom}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6366f1] text-white text-xs font-bold shadow-lg hover:brightness-110 cursor-pointer"
          >
            Criar Minha Primeira Sala
          </button>
        </div>
      ) : (
        /* Grid of Rooms */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="bg-[#111422] border border-[#1e2338] hover:border-[#2f375a] rounded-2xl overflow-hidden shadow-lg transition-all duration-300 flex flex-col justify-between group"
            >
              {/* Thumbnail Banner */}
              <div className="relative h-44 w-full overflow-hidden bg-[#0d0f1a]">
                <img 
                  src={room.image || '/horizonte_neon.jpg'} 
                  alt={room.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#111422] via-transparent to-black/30"></div>

                {room.isTemporary && (
                  <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-[#1e2338]/80 backdrop-blur-md border border-[#3b4266] text-white text-[10px] font-bold uppercase tracking-wider flex items-center space-x-1.5 shadow-md">
                    <Clock className="w-3 h-3 text-[#c084fc]" />
                    <span>Temporária</span>
                  </div>
                )}
              </div>

              {/* Room Content */}
              <div className="p-6 flex-1 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-[#c084fc] transition-colors">
                        {room.title}
                      </h3>
                      <span className="text-[10px] font-bold text-[#38bdf8] uppercase tracking-wider block mt-1">
                        {room.type || (room.url?.includes('youtube') ? 'YOUTUBE' : 'VÍDEO EXTERNO')}
                      </span>
                    </div>
                  </div>

                  {/* Metadata row */}
                  <div className="flex items-center space-x-4 text-xs text-[#94a3b8] mt-3">
                    <div className="flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#64748b]" />
                      <span>{room.date || 'Hoje'}</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Users className="w-3.5 h-3.5 text-[#64748b]" />
                      <span>{room.participants || 1} participantes</span>
                    </div>
                  </div>

                  {/* URL preview */}
                  <div className="mt-2 text-[11px] font-mono text-[#64748b] truncate">
                    {room.url}
                  </div>
                </div>

                {/* Action buttons footer */}
                <div className="pt-2 flex items-center space-x-3">
                  <button
                    onClick={() => onOpenRoom(room.id, room.title, room.url, room.videoTitle)}
                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                      room.isPrimary
                        ? 'bg-gradient-to-r from-[#7c3aed] to-[#6366f1] text-white shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_30px_rgba(124,58,237,0.5)]'
                        : 'bg-[#1b1f33] hover:bg-[#252b47] text-white border border-[#2b3352]'
                    }`}
                  >
                    <span>{room.isPrimary ? 'Entrar na sala' : 'Abrir novamente'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    onClick={(e) => handleDelete(room.id, room.title, e)}
                    className="p-3 rounded-xl bg-[#171a2b] hover:bg-rose-950/40 border border-[#22273f] hover:border-rose-500/40 text-[#64748b] hover:text-rose-400 transition-colors cursor-pointer"
                    title="Excluir sala"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Temporary Room Auto-deletion Notice */}
      <div className="p-4 rounded-xl bg-[#141829] border border-[#1e2338] text-xs text-[#94a3b8] flex items-center space-x-3">
        <AlertCircle className="w-4 h-4 text-[#a855f7] shrink-0" />
        <span>Salas temporárias são excluídas automaticamente em 24h caso não haja atividade recente.</span>
      </div>

    </div>
  );
}
