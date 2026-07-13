'use client';
import { useState, useEffect, useRef } from 'react';
import { RequestItem, CheckMark, PenPath } from './types';
import { getRenderedRect } from './utils/imageUtils';
import { IconZap, IconCalendar, IconClock, IconFileText, IconPrinter, IconX, IconCheck, IconMore, IconEdit, IconTrash } from './ui/icons';

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
  const [menuOpen, setMenuOpen] = useState(false);

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

  // 이미지 위 오버레이용 솔리드 칩
  const statusChipClass = item.is_urgent
    ? 'bg-red-600 text-white'
    : daysLeft === 0
      ? 'bg-blue-600 text-white'
      : daysLeft === 1
        ? 'bg-amber-500 text-white'
        : daysLeft > 1
          ? 'bg-slate-600 text-white'
          : 'bg-slate-900 text-white';

  return (
    <div
      className={`relative flex flex-col rounded border bg-white dark:bg-slate-900 shadow-sm transition hover:shadow-md ${
        item.is_work_done
          ? 'border-emerald-300 dark:border-emerald-700'
          : item.is_urgent
            ? 'border-red-300 dark:border-red-700 ring-1 ring-red-200 dark:ring-red-900'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
      }`}
    >
      {/* 히어로 이미지 영역 */}
      <div
        ref={imgContainerRef}
        className={`relative h-44 rounded-t overflow-hidden bg-slate-800 ${item.image_url ? 'cursor-pointer' : ''}`}
        onClick={item.image_url ? () => onImageClick(item.image_url!) : undefined}
      >
        {item.image_url ? (
          <>
            {/* 블러 백드롭 (여백 없는 배경) */}
            <img
              src={item.image_url}
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-md brightness-[0.4]"
            />
            {/* 원본 이미지 (잘림 없이 contain) */}
            <img
              src={item.image_url}
              onLoad={(e) => {
                const img = e.currentTarget;
                setNaturalDims({ w: img.naturalWidth, h: img.naturalHeight });
              }}
              className={`relative w-full h-full object-contain transition ${
                item.is_work_done ? 'grayscale-[60%] opacity-75' : ''
              }`}
              alt="작업 이미지"
            />
            {/* 썸네일 주석 오버레이 (핀 + 펜 선) */}
            {naturalDims && containerDims && (() => {
              const imgRect = getRenderedRect(containerDims.w, containerDims.h, naturalDims.w, naturalDims.h);
              const marks = item.check_marks ?? [];
              const pins = marks.filter((m): m is CheckMark => typeof (m as CheckMark).x === 'number');
              const paths = marks.filter((m): m is PenPath => Array.isArray((m as PenPath).points));
              return (
                <>
                  {paths.length > 0 && (
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                      {paths.map((p, i) => (
                        <polyline
                          key={i}
                          points={p.points.map(pt => `${imgRect.x + (pt.x / 100) * imgRect.w},${imgRect.y + (pt.y / 100) * imgRect.h}`).join(' ')}
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth={2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      ))}
                    </svg>
                  )}
                  {pins.map((mark, i) => {
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
                        <div className="w-5 h-5 bg-emerald-500 rounded-full border-2 border-white shadow flex items-center justify-center text-white text-[10px] font-bold select-none">
                          {i + 1}
                        </div>
                      </div>
                    );
                  })}
                </>
              );
            })()}
          </>
        ) : (
          /* 이미지 없는 작업: 이니셜 플레이스홀더 */
          <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900 flex flex-col items-center justify-center gap-1">
            <span className="text-5xl font-bold text-white/15 select-none">{item.company?.[0] ?? '?'}</span>
            <span className="text-[11px] text-white/30">등록된 원고 없음</span>
          </div>
        )}

        {/* 작업완료 도장 */}
        {item.is_work_done && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/90 border-2 border-white shadow-lg">
              <IconCheck className="w-8 h-8 text-white" />
            </span>
          </div>
        )}

        {/* 상단 오버레이: 상태 칩 + NEW */}
        <div className="absolute top-2 left-2 right-2 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          {isNew && (
            <span className="inline-flex items-center h-[22px] px-2 rounded-sm text-[11px] font-bold bg-white/95 text-blue-700 shadow-sm select-none animate-pulse">
              NEW
            </span>
          )}
          <button
            onClick={() => onStatusClick(statusKey)}
            className={`inline-flex items-center gap-1 h-[22px] px-2 rounded-sm text-[11px] font-bold shadow-sm cursor-pointer transition select-none ${statusChipClass} ${
              activeStatusFilter === statusKey ? 'ring-2 ring-white/70' : 'hover:opacity-90'
            }`}
            title={activeStatusFilter === statusKey ? '클릭하여 필터 해제' : '클릭하여 이 상태만 보기'}
          >
            {item.is_urgent && <IconZap className="w-3 h-3" />}
            {daysLeft === 0 && !item.is_urgent && <IconCalendar className="w-3 h-3" />}
            {daysLeft < 0 && !item.is_urgent && <IconClock className="w-3 h-3" />}
            {barText}
            {activeStatusFilter === statusKey && <IconX className="w-3 h-3" />}
          </button>
        </div>

      </div>

      {/* 업체명 / 프로그램명 (이미지 아래 — 이미지를 가리지 않게) */}
      <div className="px-3.5 pt-2.5">
        <p
          className="font-bold text-[15px] leading-tight truncate text-slate-900 dark:text-slate-100 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
          onClick={() => onCompanyClick(item.company)}
          title="클릭하면 이 업체로 검색"
        >{item.company}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{item.program}</p>
      </div>

      {/* 메타: 담당자 + 등록 시각 */}
      <div className="flex items-center gap-1.5 px-3.5 pt-1.5">
        {item.creator ? (
          <>
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold select-none">
              {item.creator[0]}
            </span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{item.creator}</span>
          </>
        ) : (
          <span className="text-xs text-slate-300 dark:text-slate-600">담당자 미지정</span>
        )}
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
      </div>

      {/* 메모 (1줄, 전체 내용은 툴팁) */}
      {item.note && (
        <div className="flex items-center gap-1.5 mx-3.5 mt-2 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900 rounded text-xs text-slate-700 dark:text-slate-300" title={item.note}>
          <IconFileText className="w-3 h-3 text-amber-500 shrink-0" />
          <span className="truncate">{item.note}</span>
        </div>
      )}

      {/* 액션 바 */}
      {isActive && (
        <div className="relative flex items-center gap-1.5 px-3.5 py-2.5 mt-auto">
          <button
            onClick={() => onWorkDone(item.id)}
            className={`flex-1 inline-flex items-center justify-center gap-1 h-8 rounded text-xs font-semibold border transition ${
              item.is_work_done
                ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                : 'bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950'
            }`}
            title={item.is_work_done ? '작업완료 취소' : '작업완료 표시'}
          >
            <IconCheck className="w-3.5 h-3.5" />
            {item.is_work_done ? '작업완료됨' : '작업완료'}
          </button>

          <button
            onClick={() => onComplete(item.id)}
            className="flex-1 inline-flex items-center justify-center h-8 rounded bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 transition"
          >
            완료
          </button>

          <button
            onClick={() => setMenuOpen(o => !o)}
            className={`inline-flex items-center justify-center w-8 h-8 rounded border transition ${
              menuOpen
                ? 'bg-slate-100 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
            title="더 보기"
          >
            <IconMore className="w-4 h-4" />
          </button>

          {/* 오버플로 메뉴 */}
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute bottom-full right-3.5 mb-1 z-20 w-36 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded shadow-lg overflow-hidden">
                {item.image_url && (
                  <button
                    onClick={() => { setMenuOpen(false); onPrintImage(item.image_url!, item.company, item.program); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition border-b border-slate-50 dark:border-slate-700"
                  >
                    <IconPrinter className="w-3.5 h-3.5 text-slate-400" />
                    원고 출력
                  </button>
                )}
                <button
                  onClick={() => { setMenuOpen(false); onEdit(item); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition border-b border-slate-50 dark:border-slate-700"
                >
                  <IconEdit className="w-3.5 h-3.5 text-slate-400" />
                  수정
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onDelete(item.id); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition"
                >
                  <IconTrash className="w-3.5 h-3.5" />
                  삭제
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
