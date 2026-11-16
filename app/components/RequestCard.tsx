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

  // 메모: 접힌 상태(2줄)에서 내용이 잘렸는지 확인 — 잘렸을 때만 '더보기'를 보여준다
  const noteRef = useRef<HTMLSpanElement>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteOverflow, setNoteOverflow] = useState(false);
  useEffect(() => {
    const el = noteRef.current;
    if (!el || noteOpen) return; // 펼친 상태에서는 잴 수 없으므로 마지막 판정을 유지
    setNoteOverflow(el.scrollHeight > el.clientHeight + 1);
  }, [item.note, noteOpen, containerDims?.w]);

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

  // 픽업 날짜 표기 (예: 11/19 (목)) — '오늘까지'·'내일까지'는 말 자체가 날짜라 생략하고,
  // 급함·지남·D-n 카드에만 상태 칩 옆에 붙여 언제가 기한인지 바로 보이게 한다
  const pickupLabel = (() => {
    if (!item.pickup_date) return null;
    if (!item.is_urgent && (daysLeft === 0 || daysLeft === 1)) return null;
    const d = new Date(`${item.pickup_date.slice(0, 10)}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    return `${d.getMonth() + 1}/${d.getDate()} (${'일월화수목금토'[d.getDay()]})`;
  })();

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
      className={`relative flex flex-col rounded-2xl border shadow-sm transition duration-200 hover:shadow-lg hover:-translate-y-0.5 ${
        item.is_work_done
          ? 'border-emerald-400 dark:border-emerald-600 ring-2 ring-emerald-300 dark:ring-emerald-700 bg-emerald-50 dark:bg-emerald-950/40'
          : item.is_urgent
            ? 'border-red-300 dark:border-red-700 ring-1 ring-red-200 dark:ring-red-900 bg-white dark:bg-slate-900'
            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900'
      }`}
    >
      {/* 작업완료 상단 리본 */}
      {item.is_work_done && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 z-20 inline-flex items-center gap-1 h-6 px-3 rounded-full bg-emerald-600 text-white text-[11px] font-extrabold shadow-md select-none pointer-events-none">
          <IconCheck className="w-3.5 h-3.5" />
          작업완료
        </div>
      )}
      {/* 히어로 이미지 영역 */}
      <div
        ref={imgContainerRef}
        className={`relative h-48 rounded-t-[15px] overflow-hidden bg-slate-100 dark:bg-slate-800 ${item.image_url ? 'cursor-pointer' : ''}`}
        onClick={item.image_url ? () => onImageClick(item.image_url!) : undefined}
      >
        {item.image_url ? (
          <>
            {/* 원고 사진 (잘림 없이 전체가 보이게 contain — 밝은 바탕 위에 올린다) */}
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
          <div className="absolute inset-0 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex flex-col items-center justify-center gap-1">
            <span className="text-5xl font-extrabold text-slate-300 dark:text-white/15 select-none">{item.company?.[0] ?? '?'}</span>
            <span className="text-[11px] text-slate-400 dark:text-white/30">등록된 원고 없음</span>
          </div>
        )}

        {/* 작업완료 도장 (비스듬히 찍힌 인주 스탬프) */}
        {item.is_work_done && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="flex items-center justify-center gap-1 px-5 py-2 rounded-md border-[3px] border-emerald-600 bg-white/85 dark:bg-slate-900/80 text-emerald-700 dark:text-emerald-300 text-xl font-black tracking-widest select-none shadow-lg -rotate-12">
              <IconCheck className="w-6 h-6" />
              작업완료
            </span>
          </div>
        )}

        {/* 상단 오버레이: 상태 칩 + NEW */}
        <div className="absolute top-2 left-2 right-2 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
          {isNew && (
            <span className="inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-extrabold bg-brand-orange text-brand shadow-sm select-none animate-pulse">
              NEW
            </span>
          )}
          <button
            onClick={() => onStatusClick(statusKey)}
            className={`inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-bold shadow-sm cursor-pointer transition select-none whitespace-nowrap ${statusChipClass} ${
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
          {pickupLabel && (
            <span
              className="inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-bold bg-white/95 dark:bg-slate-900/90 text-slate-700 dark:text-slate-200 shadow-sm select-none whitespace-nowrap tabular-nums"
              title={`픽업일: ${item.pickup_date}`}
            >
              {pickupLabel}
            </span>
          )}
        </div>

      </div>

      {/* 업체명 / 프로그램명 (이미지 아래 — 이미지를 가리지 않게) */}
      <div className="px-4 pt-3">
        <p
          className="font-extrabold text-[16px] leading-tight tracking-tight truncate text-slate-900 dark:text-slate-100 cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 hover:underline"
          onClick={() => onCompanyClick(item.company)}
          title="클릭하면 이 업체로 검색"
        >{item.company}</p>
        <p className="text-[13px] text-slate-500 dark:text-slate-400 truncate mt-1">{item.program}</p>
      </div>

      {/* 메타: 담당자 + 등록 시각 */}
      <div className="flex items-center gap-1.5 px-4 pt-2">
        {item.creator ? (
          <>
            <span className="flex items-center justify-center w-5 h-5 shrink-0 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold select-none">
              {item.creator[0]}
            </span>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">{item.creator}</span>
          </>
        ) : (
          <span className="text-xs text-slate-300 dark:text-slate-600">담당자 미지정</span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-slate-400 whitespace-nowrap tabular-nums">
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

      {/* 메모 (2줄까지 보이고, 더 길면 누르면 전체가 펼쳐진다) */}
      {item.note && (
        <div
          className={`flex items-start gap-1.5 mx-4 mt-2.5 px-2.5 py-1.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900 rounded-lg text-xs text-slate-700 dark:text-slate-300 ${
            noteOpen || noteOverflow ? 'cursor-pointer hover:border-amber-300 dark:hover:border-amber-700 transition' : ''
          }`}
          onClick={noteOpen || noteOverflow ? () => setNoteOpen(o => !o) : undefined}
          title={noteOpen ? '누르면 접힙니다' : noteOverflow ? '누르면 메모 전체가 펼쳐집니다' : undefined}
        >
          <IconFileText className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
          <span
            ref={noteRef}
            className={`min-w-0 flex-1 whitespace-pre-line break-words ${noteOpen ? '' : 'line-clamp-2'}`}
          >
            {item.note}
          </span>
          {(noteOpen || noteOverflow) && (
            <span className="shrink-0 self-end text-[10px] font-semibold text-amber-600 dark:text-amber-400 select-none">
              {noteOpen ? '접기' : '더보기'}
            </span>
          )}
        </div>
      )}

      {/* 액션 바 */}
      {isActive && (
        <div className="relative flex items-center gap-2 px-4 pt-3 pb-4 mt-auto">
          <button
            onClick={() => onWorkDone(item.id)}
            className={`flex-1 inline-flex items-center justify-center gap-1 h-9 rounded-lg text-[13px] font-bold border whitespace-nowrap transition ${
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
            className="flex-1 inline-flex items-center justify-center h-9 rounded-lg bg-brand dark:bg-blue-600 text-[13px] font-bold text-white whitespace-nowrap hover:bg-brand-soft dark:hover:bg-blue-500 transition"
          >
            완료
          </button>

          <button
            onClick={() => setMenuOpen(o => !o)}
            className={`inline-flex items-center justify-center w-9 h-9 shrink-0 rounded-lg border transition ${
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
              <div className="absolute bottom-full right-4 mb-1 z-20 w-36 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl shadow-lg overflow-hidden">
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
