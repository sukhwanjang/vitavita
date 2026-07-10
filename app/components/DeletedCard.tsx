'use client';
import { RequestItem } from './types';
import { supabase } from '../../lib/supabase';
import { IconClock, IconTrash } from './ui/icons';

interface DeletedCardProps {
  item: RequestItem;
  onRefresh: () => void;
}

export default function DeletedCard({ item, onRefresh }: DeletedCardProps) {
  const handlePermanentDelete = async () => {
    if (window.confirm('진짜로 완전 삭제할까요?')) {
      await supabase.from('request').delete().eq('id', item.id);
      onRefresh();
    }
  };

  return (
    <div className="relative flex flex-col justify-between rounded overflow-hidden border border-slate-200 bg-white shadow-sm opacity-80">
      <span className="absolute left-0 top-0 bottom-0 w-1 bg-slate-300" />
      <div className="flex flex-col pl-5 pr-4 py-3.5 space-y-3">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 h-[22px] px-2 rounded text-[11px] font-semibold bg-slate-100 text-slate-500 border border-slate-200 select-none">
            <IconTrash className="w-3 h-3" />
            삭제됨
          </span>
        </div>
        <div>
          <p className="text-base font-bold text-slate-700 truncate">{item.company}</p>
          <p className="text-[13px] text-slate-500 truncate mt-0.5">{item.program}</p>
        </div>
        {item.image_url && (
          <img src={item.image_url} className="w-full h-32 object-contain rounded border border-slate-200 bg-slate-50 grayscale" />
        )}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <IconClock className="w-3 h-3" />
          <span>등록</span>
          <span className="text-slate-500">{new Date(item.created_at).toLocaleString('ko-KR')}</span>
        </div>
        <div className="flex items-center justify-end pt-2.5 border-t border-slate-100">
          <button
            onClick={handlePermanentDelete}
            className="inline-flex items-center gap-1 h-7 px-2.5 rounded border border-slate-200 bg-white text-[11px] font-semibold text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition"
          >
            <IconTrash className="w-3 h-3" />
            완전 삭제
          </button>
        </div>
      </div>
    </div>
  );
}
