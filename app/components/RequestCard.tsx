'use client';
import { useState, useEffect, useRef } from 'react';
import { RequestItem } from './types';
import { getRenderedRect } from './utils/imageUtils';
import { IconZap, IconCalendar, IconClock, IconImage, IconFileText, IconPrinter, IconX, IconCheck } from './ui/icons';

interface RequestCardProps {
  item: RequestItem;
  onEdit: (item: RequestItem) => void;
  onComplete: (id: number) => void;
  onDelete: (id: number) => void;
  onImageClick: (url: string) => void;
  onPrintImage: (imageUrl: string, company: string, program: string) => void;
  onWorkDone: (id: number) => void;
  onCompanyClick: (company: string) => void;
  onStatusClick: (key: string) => void;
  activeStatusFilter: string | null;
  isNew?: boolean;
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
  onStatusClick,
  activeStatusFilter,
  isNew = false,
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

  // 이 카드의 상태 필터 키 (board.tsx의 statusFilter와 매핑)
  const statusKey = item.is_urgent
    ? 'urgent'
    : daysLeft === 0
      ? 'today'
      : daysLeft !== null && daysLeft > 0
        ? `d-${daysLeft}`
        : 'overdue';

  // 색상 우선순위: 급함(빨강) > 오늘(파랑) > 내일(앰버) > 모레 이후(회색) > 지남(진회색)
  const barText = item.is_urgent
    ? '급함'
    : daysLeft === 0
      ? '오늘까지'
      : daysLeft === 1
        ? '내일까지'
        : daysLeft > 1
          ? `D-${daysLeft}`
          : '지남';

  const statusChipClass = item.is_urgent
    ? 'bg-red-50 text-red-700 border-red-200'
    : daysLeft === 0
      ? 'bg-blue-50 text-blue-700 border-blue-200'
      : daysLeft === 1
        ? 'bg-amber-50 text-amber-700 border-amber-300'
        : daysLeft > 1
          ? 'bg-slate-50 text-slate-600 border-slate-200'
          : 'bg-slate-800 text-white border-slate-800';

  const accentBarClass = item.is_work_done
    ? 'bg-emerald-500'
    : item.is_urgent
      ? 'bg-red-500'
      : daysLeft === 0
        ? 'bg-blue-500'
        : daysLeft === 1
          ? 'bg-amber-400'
          : daysLeft > 1
            ? 'bg-slate-300'
            : 'bg-slate-700';

  return (
    <div
      className={`relative flex flex-col rounded overflow-hidden border bg-white shadow-sm transition hover:shadow-md ${
        item.is_work_done ? 'border-emerald-300' : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* 좌측 상태 액센트 바 */}
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${accentBarClass}`} />

      {/* 상단: 상태 뱃지 + 등록 시각 */}
      <div className="flex items-center gap-1.5 pl-5 pr-4 pt-3.5">
        {isNew && (
          <span className="inline-flex items-center h-[22px] px-2 rounded text-[11px] font-bold bg-blue-600 text-white select-none">
            NEW
          </span>
        )}
        <button
          onClick={() => onStatusClick(statusKey)}
          className={`inline-flex items-center gap-1 h-[22px] px-2 rounded text-[11px] font-semibold border cursor-pointer transition select-none ${statusChipClass} ${
            activeStatusFilter === statusKey ? 'ring-2 ring-blue-500/40' : 'hover:opacity-80'
          }`}
          title={activeStatusFilter === statusKey ? '클릭하여 필터 해제' : '클릭하여 이 상태만 보기'}
        >
          {item.is_urgent && <IconZap className="w-3 h-3" />}
          {daysLeft === 0 && !item.is_urgent && <IconCalendar className="w-3 h-3" />}
          {daysLeft < 0 && !item.is_urgent && <IconClock className="w-3 h-3" />}
          {barText}
          {activeStatusFilter === statusKey && <IconX className="w-3 h-3" />}
        </button>
        {item.is_work_done && (
          <span className="inline-flex items-center gap-1 h-[22px] px-2 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 select-none">
            <IconCheck className="w-3 h-3" />
            작업완료
          </span>
        )}
        {isActive && (
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-400">
            <IconClock className="w-3 h-3" />
            {new Date(item.created_at).toLocaleString('ko-KR', {
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            })}
          </span>
        )}
      </div>

      {/* 카드 본문 */}
      <div className="flex flex-col flex-1 pl-5 pr-4 py-3.5 space-y-3">
        <div>
          <p
            className="text-base font-bold text-slate-900 truncate cursor-pointer hover:text-blue-700 transition"
            onClick={() => onCompanyClick(item.company)}
            title="클릭하면 이 업체로 검색"
          >{item.company}</p>
          <p className="text-[13px] text-slate-500 truncate mt-0.5">{item.program}</p>
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
                className="cursor-pointer w-full h-32 object-contain rounded border border-slate-200 bg-slate-50 transition hover:border-blue-300"
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
                    <div className="w-5 h-5 bg-emerald-500 rounded-full border border-white shadow flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center w-full h-24 rounded border border-dashed border-slate-200 bg-slate-50/50 text-slate-300">
              <IconImage className="w-6 h-6" />
              <span className="text-[11px] mt-1.5 text-slate-400">이미지 없음</span>
            </div>
          )}
        </div>

        {/* 픽업일 표시 */}
        <div className="flex items-center gap-1.5 text-[13px]">
          <IconCalendar className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-500">픽업</span>
          <span className={`font-semibold ${daysLeft === 0 ? 'text-blue-600' : daysLeft === 1 ? 'text-amber-600' : daysLeft < 0 ? 'text-slate-800' : 'text-slate-700'}`}>
            {item.pickup_date ? (() => {
              const daysLeft = Math.ceil(
                (new Date(item.pickup_date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0))
                / (1000 * 60 * 60 * 24)
              );
              if (daysLeft === 0) return '오늘';
              if (daysLeft === 1) return '내일';
              if (daysLeft > 1) return `D-${daysLeft}`;
              return '지남';
            })() : '-'}
          </span>
        </div>

        {/* 메모 */}
        {item.note && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded px-3 py-2 text-xs text-slate-700">
            <IconFileText className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <span>{item.note}</span>
          </div>
        )}

        {/* 버튼 영역 */}
        {isActive && (
          <div className="flex flex-wrap gap-1.5 items-center justify-end pt-2 mt-auto border-t border-slate-100">
            {item.image_url && (
              <button
                onClick={() => onPrintImage(item.image_url!, item.company, item.program)}
                className="inline-flex items-center gap-1 h-7 px-2.5 rounded border border-slate-200 bg-white text-[11px] font-medium text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition mr-auto"
                title="원고 출력"
              >
                <IconPrinter className="w-3.5 h-3.5" />
                출력
              </button>
            )}

            <button
              onClick={() => onWorkDone(item.id)}
              className={`inline-flex items-center gap-1 h-7 px-2.5 rounded text-[11px] font-semibold border transition ${
                item.is_work_done
                  ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                  : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50'
              }`}
            >
              <IconCheck className="w-3.5 h-3.5" />
              {item.is_work_done ? '작업완료 취소' : '작업완료'}
            </button>

            <button
              onClick={() => onEdit(item)}
              className="inline-flex items-center h-7 px-2.5 rounded border border-slate-200 bg-white text-[11px] font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition"
            >
              수정
            </button>

            <button
              onClick={() => onComplete(item.id)}
              className="inline-flex items-center h-7 px-3 rounded bg-blue-600 text-[11px] font-semibold text-white hover:bg-blue-700 transition"
            >
              완료
            </button>

            <button
              onClick={() => onDelete(item.id)}
              className="inline-flex items-center h-7 px-2.5 rounded border border-slate-200 bg-white text-[11px] font-semibold text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition"
            >
              삭제
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
