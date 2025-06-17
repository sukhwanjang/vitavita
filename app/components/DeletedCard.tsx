'use client';
import { RequestItem } from './types';
import { supabase } from '../../lib/supabase';

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
    <div className="flex flex-col justify-between rounded-2xl shadow-md overflow-hidden border-2 border-gray-300 bg-white">
      <div className="h-8 bg-gray-200 flex items-center justify-center text-gray-700 text-xs font-bold">삭제됨</div>
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
        <div className="flex items-center gap-2 justify-end mt-2">
          <span className="text-gray-400 text-xs">🗑 삭제됨</span>
          <button
            onClick={handlePermanentDelete}
            className="text-xs text-red-500 underline hover:text-red-700"
          >
            완전 삭제
          </button>
        </div>
      </div>
    </div>
  );
} 