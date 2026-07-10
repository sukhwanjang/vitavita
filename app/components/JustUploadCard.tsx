'use client';
import { RequestItem } from './types';
import { supabase } from '../../lib/supabase';
import { IconClock, IconInbox, IconFolder } from './ui/icons';

interface JustUploadCardProps {
  item: RequestItem;
  onRefresh: () => void;
}

export default function JustUploadCard({ item, onRefresh }: JustUploadCardProps) {
  const handleMoveToWork = async () => {
    await supabase.from('request').update({ is_just_upload: false }).eq('id', item.id);
    onRefresh();
  };

  return (
    <div className="relative flex flex-col justify-between rounded-lg overflow-hidden border border-slate-200 bg-white shadow-sm">
      <span className="absolute left-0 top-0 bottom-0 w-1 bg-amber-400" />
      <div className="flex flex-col pl-5 pr-4 py-3.5 space-y-3">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 h-[22px] px-2 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 select-none">
            <IconInbox className="w-3 h-3" />
            원고 대기
          </span>
        </div>
        <div>
          <p className="text-base font-bold text-slate-900 truncate">{item.company}</p>
          <p className="text-[13px] text-slate-500 truncate mt-0.5">{item.program}</p>
        </div>
        {item.image_url && (
          <img src={item.image_url} className="w-full h-32 object-contain rounded-md border border-slate-200 bg-slate-50" />
        )}
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <IconClock className="w-3 h-3" />
          <span>등록</span>
          <span className="text-slate-500">{new Date(item.created_at).toLocaleString('ko-KR')}</span>
        </div>
        <div className="flex items-center justify-end pt-2.5 border-t border-slate-100">
          <button
            onClick={handleMoveToWork}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 transition"
          >
            <IconFolder className="w-3.5 h-3.5" />
            작업폴더로 이동
          </button>
        </div>
      </div>
    </div>
  );
}
