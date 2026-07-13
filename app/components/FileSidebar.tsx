'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { FileDrop, RequestItem } from './types';
import DropList, { fileNameOf } from './DropList';
import {
  IconInbox, IconChevronLeft, IconChevronRight,
  IconVolume, IconVolumeOff, IconPrinter,
} from './ui/icons';

// 헤더(앱바 64px + 탭 44px + 보더 1px) 아래에 고정
const HEADER_OFFSET = 109;

interface FileSidebarProps {
  drops: FileDrop[];
  error: string | null;
  onRemove: (id: number) => void;
  onRestore: (drop: FileDrop) => Promise<boolean>;
  requests?: RequestItem[]; // 연결된 작업 카드 표시용
  onImageClick?: (item: RequestItem) => void; // 연결 카드 썸네일 클릭 → 검수 뷰어
  fullPage?: boolean; // 출력 전용 화면 (/queue) — 출력대기만 꽉 차게
  open: boolean;
  onToggle: () => void;
  newIds: Set<number>;
  onMarkAllSeen: () => void;
  soundOn: boolean;
  onToggleSound: () => void;
}

export default function FileSidebar({
  drops,
  error,
  onRemove,
  onRestore,
  requests = [],
  onImageClick,
  fullPage = false,
  open,
  onToggle,
  newIds,
  onMarkAllSeen,
  soundOn,
  onToggleSound,
}: FileSidebarProps) {
  const router = useRouter();
  const [undoDrop, setUndoDrop] = useState<FileDrop | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const newCount = newIds.size;

  // 완료 처리: 바로 지우되 6초 동안 실행 취소 가능
  const handleRemove = (drop: FileDrop) => {
    setUndoDrop(drop);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = setTimeout(() => setUndoDrop(null), 6000);
    onRemove(drop.id);
  };

  const handleUndo = async () => {
    if (!undoDrop) return;
    const drop = undoDrop;
    setUndoDrop(null);
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    await onRestore(drop);
  };

  const soundToggleButton = (
    <button
      onClick={onToggleSound}
      title={soundOn ? '알림음 끄기' : '알림음 켜기'}
      className="flex items-center justify-center w-6 h-6 rounded text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition"
    >
      {soundOn ? <IconVolume className="w-3.5 h-3.5" /> : <IconVolumeOff className="w-3.5 h-3.5 text-slate-300" />}
    </button>
  );

  const newAlertStrip = newCount > 0 && (
    <div className="flex items-center gap-1.5 px-3 h-9 bg-blue-600 text-white text-xs font-semibold shrink-0">
      <span className="flex items-center justify-center w-4 h-4 rounded-full bg-white text-blue-700 text-[9px] font-bold animate-pulse">{newCount}</span>
      <span>새 출력요청 {newCount}건</span>
      <button
        onClick={onMarkAllSeen}
        className="ml-auto h-6 px-2 rounded bg-white/20 hover:bg-white/30 text-[11px] font-semibold transition"
      >
        모두 확인
      </button>
    </div>
  );

  const undoBar = undoDrop && (
    <div className="flex items-center gap-2 px-3 h-10 bg-slate-800 text-white text-xs shrink-0">
      <span className="truncate">완료 처리됨: {fileNameOf(undoDrop.path)}</span>
      <button
        onClick={handleUndo}
        className="ml-auto shrink-0 font-bold text-blue-300 hover:text-blue-200 transition"
      >
        실행 취소
      </button>
    </div>
  );

  const listBody = (
    <DropList
      drops={drops}
      error={error}
      requests={requests}
      newIds={newIds}
      onRemove={handleRemove}
      onImageClick={onImageClick}
    />
  );

  // 출력 전용 화면 (/queue): 출력대기만 화면 가득 — 좁은 창에 최적화
  if (fullPage) {
    return (
      <div className="flex flex-col h-[100dvh] bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2 px-4 h-12 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shrink-0">
          <IconInbox className="w-4 h-4 text-slate-500" />
          <h2 className="font-semibold text-slate-800 dark:text-slate-200 text-sm">출력대기</h2>
          {drops.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold">
              {drops.length}
            </span>
          )}
          <span className="ml-auto flex items-center gap-1.5">
            {soundToggleButton}
            <button
              onClick={() => router.push('/')}
              title="현황판으로 이동"
              className="h-7 px-2.5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"
            >
              현황판
            </button>
          </span>
        </div>
        {newAlertStrip}
        <div className="flex-1 overflow-y-auto">{listBody}</div>
        {undoBar}
      </div>
    );
  }

  return (
    <>
      {/* 데스크톱: 화면 좌측에 고정된 패널 */}
      <aside
        className={`hidden lg:flex flex-col fixed left-0 bottom-0 z-30 bg-white dark:bg-slate-900 border-r transition-all duration-200 ${
          open ? 'w-72' : 'w-12'
        } ${newCount > 0 ? 'border-blue-300 dark:border-blue-700' : 'border-slate-200 dark:border-slate-700'}`}
        style={{ top: HEADER_OFFSET }}
      >
        {open ? (
          <>
            <div className="flex items-center gap-2 px-4 h-11 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 shrink-0">
              <IconInbox className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-800 dark:text-slate-200 text-[13px]">출력대기</h2>
              {drops.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold">
                  {drops.length}
                </span>
              )}
              <span className="ml-auto flex items-center gap-0.5">
                <button
                  onClick={() => router.push('/queue')}
                  title="출력대기 전용 화면 (출력기 컴퓨터용 — 출력대기만 크게 표시)"
                  className="flex items-center justify-center w-6 h-6 rounded text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition"
                >
                  <IconPrinter className="w-3.5 h-3.5" />
                </button>
                {soundToggleButton}
                <button
                  onClick={onToggle}
                  title="접기"
                  className="flex items-center justify-center w-6 h-6 rounded text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition"
                >
                  <IconChevronLeft className="w-4 h-4" />
                </button>
              </span>
            </div>
            {newAlertStrip}
            <div className="flex-1 overflow-y-auto">{listBody}</div>
            {undoBar}
          </>
        ) : (
          <button
            onClick={onToggle}
            title="출력대기 열기"
            className={`flex flex-col items-center gap-3 pt-4 w-full h-full transition ${
              newCount > 0 ? 'bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-950' : 'hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <IconChevronRight className="w-4 h-4 text-slate-400" />
            <IconInbox className={`w-4 h-4 ${newCount > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`} />
            {newCount > 0 ? (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-blue-600 text-white text-[11px] font-bold animate-pulse">
                {newCount}
              </span>
            ) : drops.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold">
                {drops.length}
              </span>
            )}
          </button>
        )}
      </aside>

      {/* 모바일: 본문 흐름 안의 인라인 패널 */}
      <div className="lg:hidden w-full">
        <div className={`bg-white dark:bg-slate-900 rounded border overflow-hidden ${newCount > 0 ? 'border-blue-300 dark:border-blue-700' : 'border-slate-200 dark:border-slate-700'}`}>
          <div className="flex items-center gap-2 bg-slate-50 px-4 h-11 border-b border-slate-200">
            <IconInbox className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-200 text-[13px]">출력대기</h2>
            {drops.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold">
                {drops.length}
              </span>
            )}
            <span className="ml-auto flex items-center gap-0.5">
              <button
                onClick={() => router.push('/queue')}
                title="출력대기 전용 화면 (출력기 컴퓨터용 — 출력대기만 크게 표시)"
                className="flex items-center justify-center w-6 h-6 rounded text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition"
              >
                <IconPrinter className="w-3.5 h-3.5" />
              </button>
              {soundToggleButton}
            </span>
          </div>
          {newAlertStrip}
          <div className="max-h-[50vh] overflow-y-auto">{listBody}</div>
          {undoBar}
        </div>
      </div>
    </>
  );
}
