'use client';
import { useState, useEffect, useRef } from 'react';
import { RequestItem } from './types';
import { supabase } from '../../lib/supabase';
import { getRenderedRect } from './utils/imageUtils';

interface CompletedCardProps {
  item: RequestItem;
  onRecover: (id: number) => void;
  onRefresh: () => void;
  onImageClick: (url: string) => void;
  onCompanyClick: (company: string) => void;
}

export default function CompletedCard({ item, onRecover, onRefresh, onImageClick, onCompanyClick }: CompletedCardProps) {
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const [naturalDims, setNaturalDims] = useState<{ w: number; h: number } | null>(null);
  const [containerDims, setContainerDims] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!imgContainerRef.current) return;
    const el = imgContainerRef.current;
    setContainerDims({ w: el.clientWidth, h: el.clientHeight });

    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      setContainerDims({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
            <p
              className="text-lg font-bold truncate cursor-pointer hover:text-blue-600 hover:underline"
              onClick={() => onCompanyClick(item.company)}
            >{item.company}</p>
            <p className="text-sm text-gray-600 truncate">{item.program}</p>
          </div>
          {item.image_url && (
            <div ref={imgContainerRef} className="relative w-full h-32">
              <img
                src={item.image_url}
                onClick={() => onImageClick(item.image_url!)}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setNaturalDims({ w: img.naturalWidth, h: img.naturalHeight });
                }}
                className="cursor-pointer w-full h-32 object-contain rounded-md border bg-gray-50 transition-transform duration-200 hover:scale-105 hover:shadow-lg"
                alt="작업 이미지"
              />
              {naturalDims && containerDims && item.check_marks?.map((mark, i) => {
                const imgRect = getRenderedRect(containerDims.w, containerDims.h, naturalDims.w, naturalDims.h);
                const posX = imgRect.x + (mark.x / 100) * imgRect.w;
                const posY = imgRect.y + (mark.y / 100) * imgRect.h;
                return (
                  <div
                    key={i}
                    className="absolute pointer-events-none"
                    style={{
                      left: posX,
                      top: posY,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <div className="w-5 h-5 bg-green-500 rounded-full border border-black shadow flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* 메모 */}
          {item.note && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-2 mt-2 text-xs text-gray-800 rounded flex items-start gap-2 shadow-sm">
              <span className="text-lg">📝</span>
              <span>{item.note}</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="p-4 pt-0">
        <div className="text-xs text-gray-500 mb-2">
          <div>🕒 업로드: {new Date(item.created_at).toLocaleString('ko-KR')}</div>
          <div>✅ 완료: {item.updated_at ? new Date(item.updated_at).toLocaleString('ko-KR') : '-'}</div>
        </div>
        <div className="flex items-center gap-2 justify-end">
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