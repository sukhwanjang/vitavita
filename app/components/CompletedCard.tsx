'use client';
import { RequestItem } from './types';
import { supabase } from '../../lib/supabase';

interface CompletedCardProps {
  item: RequestItem;
  onRecover: (id: number) => void;
  onRefresh: () => void;
  onImageClick: (url: string) => void;
}

export default function CompletedCard({ item, onRecover, onRefresh, onImageClick }: CompletedCardProps) {
  const handlePermanentDelete = async () => {
    if (window.confirm('정말 완전 삭제하시겠습니까?')) {
      await supabase.from('request').delete().eq('id', item.id);
      onRefresh();
    }
  };

  return (
    <div className="flex flex-col justify-between rounded-2xl shadow-md overflow-hidden border-2 border-gray-300 bg-white">
      <div>
        <div className="h-8 bg-gray-200 flex items-center justify-center text-gray-700 text-xs font-bold">완료</div>
        <div className="flex flex-col p-4 space-y-2">
          <div>
            <p className="text-lg font-bold truncate">{item.company}</p>
            <p className="text-sm text-gray-600 truncate">{item.program}</p>
          </div>
          {item.image_url && (
            <img 
              src={item.image_url} 
              onClick={() => onImageClick(item.image_url!)}
              className="cursor-pointer w-full h-32 object-contain rounded-md border bg-gray-50 transition-transform duration-200 hover:scale-105 hover:shadow-lg" 
              alt="작업 이미지"
            />
          )}
          
          {/* 메모 */}
          {item.note && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-2 mt-2 text-xs text-gray-800 rounded flex items-start gap-2 shadow-sm">
              <span className="text-lg">📝</span>
              <span>{item.note}</span>
            </div>
          )}
          
          <div className="text-xs text-gray-500 mt-2">
            <div>🕒 업로드: {new Date(item.created_at).toLocaleString('ko-KR')}</div>
            <div>✅ 완료: {item.updated_at ? new Date(item.updated_at).toLocaleString('ko-KR') : '-'}</div>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-2 justify-end p-4 pt-0">
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
  );
} 