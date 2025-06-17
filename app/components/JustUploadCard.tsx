'use client';
import { RequestItem } from './types';
import { supabase } from '../../lib/supabase';

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
    <div className="flex flex-col justify-between rounded-2xl shadow-md overflow-hidden border-2 border-yellow-400 bg-white">
      <div className="h-8 bg-yellow-200 flex items-center justify-center text-yellow-900 text-xs font-bold">바빠서 원고만 올림</div>
      <div className="flex flex-col p-4 space-y-2">
        <div>
          <p className="text-lg font-bold truncate">{item.company}</p>
          <p className="text-sm text-gray-600 truncate">{item.program}</p>
        </div>
        {item.image_url && (
          <img src={item.image_url} className="w-full h-32 object-contain rounded-md border bg-gray-50" />
        )}
        <div className="text-xs text-gray-500 mt-2">
          <div>🕒 업로드: {new Date(item.created_at).toLocaleString('ko-KR')}</div>
        </div>
        <div className="flex gap-2 justify-end items-center mt-2">
          <button 
            onClick={handleMoveToWork}
            className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded font-semibold text-xs shadow hover:bg-yellow-300 transition"
          >
            작업폴더로 이동
          </button>
        </div>
      </div>
    </div>
  );
} 