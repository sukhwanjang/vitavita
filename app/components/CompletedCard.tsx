'use client';
import { RequestItem } from './types';
import { supabase } from '../../lib/supabase';

interface CompletedCardProps {
  item: RequestItem;
  onRecover: (id: number) => void;
  onRefresh: () => void;
}

export default function CompletedCard({ item, onRecover, onRefresh }: CompletedCardProps) {
  const handlePermanentDelete = async () => {
    if (window.confirm('정말 완전 삭제하시겠습니까?')) {
      await supabase.from('request').delete().eq('id', item.id);
      onRefresh();
    }
  };

  return (
    <div className="flex flex-col justify-between rounded-2xl shadow-md overflow-hidden border-2 border-gray-300 bg-white">
      <div className="h-8 bg-gray-200 flex items-center justify-center text-gray-700 text-xs font-bold">완료</div>
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
          <div>✅ 완료: {item.updated_at ? new Date(item.updated_at).toLocaleString('ko-KR') : '-'}</div>
        </div>
        <div className="flex items-center gap-2 justify-end mt-2">
          <span className="text-green-600 text-xs">✅ 완료됨</span>
          <button
            onClick={() => onRecover(item.id)}
            className="text-xs text-blue-500 underline hover:text-blue-700"
          >
            복구
          </button>
          <button
            onClick={handlePermanentDelete}
            className="text-xs text-red-500 underline hover:text-red-700"
          >
            삭제
          </button>
        </div>
      </div>
    </div>
  );
} 