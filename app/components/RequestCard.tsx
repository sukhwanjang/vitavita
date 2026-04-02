'use client';
import { useState, useEffect, useRef } from 'react';
import { RequestItem } from './types';
import { getRenderedRect } from './utils/imageUtils';

interface RequestCardProps {
  item: RequestItem;
  onEdit: (item: RequestItem) => void;
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
  onImageClick: (url: string) => void;
  onPrintImage: (imageUrl: string, company: string, program: string) => void;
  onWorkDone: (id: number) => void;
  onCompanyClick: (company: string) => void;
}

export default function RequestCard({
  item,
  onEdit,
  onComplete,
  onDelete,
  onImageClick,
  onPrintImage,
  onWorkDone,
  onCompanyClick,
}: RequestCardProps) {
  const isActive = !item.completed && !item.is_deleted;

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
  
  // 날짜 계산
  const daysLeft = item.pickup_date
    ? Math.ceil(
        (new Date(item.pickup_date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0))
        / (1000 * 60 * 60 * 24)
      )
    : null;

  // 색상 우선순위: 급함 > 오늘 > 내일이후 > 지남
  const barColor = item.is_urgent
    ? 'bg-orange-500'
    : daysLeft === 0
      ? 'bg-red-400'
      : daysLeft > 0
        ? 'bg-blue-500'
        : 'bg-black';

  const barText = item.is_urgent
    ? '급함'
    : daysLeft === 0
      ? '오늘까지'
      : daysLeft > 0
        ? `D-${daysLeft}`
        : '지남';

  return (
    <div
      className={`flex flex-col justify-between rounded-2xl shadow-lg overflow-hidden border transition-transform duration-200 hover:scale-[1.02] hover:shadow-2xl ${
        item.is_work_done
          ? 'bg-green-50 border-green-300'
          : item.completed
            ? 'bg-white border-gray-200'
            : item.is_urgent
              ? 'bg-white border-orange-400'
              : daysLeft === 0
                ? 'bg-white border-red-300'
                : daysLeft > 0
                  ? 'bg-white border-blue-300'
                  : 'bg-white border-gray-300'
      }`}
    >
      {/* 상단 상태 뱃지 */}
      <div className="flex items-center justify-start px-4 pt-4">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm
          ${item.is_urgent ? 'bg-orange-100 text-orange-700' : daysLeft === 0 ? 'bg-red-100 text-red-700' : daysLeft > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-800 text-white'}`}
        >
          {item.is_urgent && <span className="mr-1">⚡</span>}
          {daysLeft === 0 && !item.is_urgent && <span className="mr-1">📅</span>}
          {daysLeft < 0 && !item.is_urgent && <span className="mr-1">⏰</span>}
          {barText}
        </span>
      </div>

      {/* 카드 본문 */}
      <div className={`flex flex-col p-4 space-y-3 h-full ${item.is_work_done ? 'bg-green-50' : 'bg-white'}`}>
        <div>
          <p
            className="text-xl font-extrabold text-gray-900 truncate mb-1 cursor-pointer hover:text-blue-600 hover:underline"
            onClick={() => onCompanyClick(item.company)}
          >{item.company}</p>
          <p className="text-sm text-gray-500 truncate">{item.program}</p>
        </div>

        <div className="flex justify-center items-center w-full min-h-[96px]">
          {item.image_url ? (
            <div ref={imgContainerRef} className="relative w-full h-32">
              <img
                src={item.image_url}
                onClick={() => onImageClick(item.image_url!)}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  setNaturalDims({ w: img.naturalWidth, h: img.naturalHeight });
                }}
                className="cursor-pointer w-full h-32 object-contain rounded-lg border bg-gray-50 shadow-sm transition-transform duration-200 hover:scale-105 hover:shadow-lg"
                alt="작업 이미지"
              />
              {/* 썸네일 체크마크 오버레이 */}
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
          ) : (
            <div className="flex flex-col items-center justify-center w-full h-24 text-gray-300 text-3xl">
              <span className="material-icons">image_not_supported</span>
              <span className="text-xs mt-1">이미지 없음</span>
            </div>
          )}
        </div>

        {/* 픽업일 표시 */}
        <div className={`text-sm font-bold mt-2 ${daysLeft === 0 ? 'text-red-500' : daysLeft < 0 ? 'text-gray-800' : 'text-gray-700'}`}>
          📅 픽업 {item.pickup_date ? (() => {
            const daysLeft = Math.ceil(
              (new Date(item.pickup_date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0))
              / (1000 * 60 * 60 * 24)
            );
            if (daysLeft === 0) return '오늘';
            if (daysLeft > 0) return `D-${daysLeft}`;
            return '지남';
          })() : '-'}
        </div>

        {/* 메모 */}
        {item.note && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-2 mt-2 text-xs text-gray-800 rounded flex items-start gap-2 shadow-sm">
            <span className="text-lg">📝</span>
            <span>{item.note}</span>
          </div>
        )}

        {/* 버튼 영역 */}
        <div className="pt-2 flex flex-wrap gap-2 items-center justify-end mt-2">
          {isActive && (
            <>
              {/* 업로드 시간 추가 */}
              <span className="text-[10px] text-gray-400 mr-auto">
                🕒 {new Date(item.created_at).toLocaleString('ko-KR', {
                  month: '2-digit',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: false
                })}
              </span>

              {item.image_url && (
                <button
                  onClick={() => onPrintImage(item.image_url!, item.company, item.program)}
                  className="px-3 py-1 bg-purple-400 text-white rounded hover:bg-purple-500 text-xs"
                >
                  🖨️ 출력
                </button>
              )}

              <button
                onClick={() => onWorkDone(item.id)}
                className={`rounded-lg px-4 py-1 font-semibold shadow text-xs transition ${
                  item.is_work_done 
                    ? 'bg-green-500 text-white hover:bg-green-600' 
                    : 'bg-green-50 text-green-700 border border-green-300 hover:bg-green-100'
                }`}
              >
                {item.is_work_done ? '작업완료 취소' : '작업완료'}
              </button>

              <button
                onClick={() => onEdit(item)}
                className="rounded-lg px-4 py-1 font-semibold shadow bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs transition"
              >
                수정
              </button>
              
              <button
                onClick={() => onComplete(item.id)}
                className="rounded-lg px-4 py-1 font-semibold shadow bg-green-100 text-green-700 hover:bg-green-200 text-xs transition"
              >
                완료
              </button>
              
              <button
                onClick={() => onDelete(item.id)}
                className="rounded-lg px-4 py-1 font-semibold shadow bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs transition"
              >
                삭제
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
} 