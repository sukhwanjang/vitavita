'use client';
import { useState, useRef } from 'react';
import { FileDrop, RequestItem } from './types';
import {
  IconInbox, IconCopy, IconCheck, IconChevronLeft, IconChevronRight,
  IconZap, IconFileText, IconVolume, IconVolumeOff,
} from './ui/icons';

const fileNameOf = (path: string) => path.split('\\').pop()?.split('/').pop() ?? path;
const folderOf = (path: string) => {
  const name = fileNameOf(path);
  return path.slice(0, path.length - name.length).replace(/[\\/]+$/, '');
};
const extOf = (path: string) => {
  const name = fileNameOf(path);
  const dot = name.lastIndexOf('.');
  if (dot === -1 || dot === name.length - 1) return null;
  const ext = name.slice(dot + 1).toUpperCase();
  return ext.length <= 4 ? ext : null;
};

// 상대 시간 표시 (10초 폴링 주기마다 자연스럽게 갱신됨)
const relTime = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return new Date(iso).toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  });
};

// 대기 시간(분)
const waitMinutes = (iso: string) =>
  Math.floor((Date.now() - new Date(iso).getTime()) / 60000);

// 헤더(앱바 64px + 탭 44px + 보더 1px) 아래에 고정
const HEADER_OFFSET = 109;

interface FileSidebarProps {
  drops: FileDrop[];
  error: string | null;
  onRemove: (id: number) => void;
  onRestore: (drop: FileDrop) => Promise<boolean>;
  requests?: RequestItem[]; // 연결된 작업 카드 표시용
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
  open,
  onToggle,
  newIds,
  onMarkAllSeen,
  soundOn,
  onToggleSound,
}: FileSidebarProps) {
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [undoDrop, setUndoDrop] = useState<FileDrop | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const newCount = newIds.size;

  // 긴급 먼저, 그다음 최신순
  const sortedDrops = [...drops].sort((a, b) =>
    ((b.is_urgent ? 1 : 0) - (a.is_urgent ? 1 : 0)) ||
    (new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  );

  const handleCopy = async (id: number, path: string) => {
    try {
      await navigator.clipboard.writeText(path);
    } catch {
      // 클립보드 API가 막힌 환경 대비 폴백
      const ta = document.createElement('textarea');
      ta.value = path;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopiedId(id);
    setTimeout(() => setCopiedId(prev => (prev === id ? null : prev)), 2000);
  };

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

  const listBody = error ? (
    <p className="p-4 text-xs text-red-500">
      출력대기를 불러올 수 없습니다.<br />({error})
    </p>
  ) : sortedDrops.length === 0 ? (
    <div className="flex flex-col items-center gap-2 p-8 text-slate-300 dark:text-slate-600">
      <IconInbox className="w-7 h-7" />
      <p className="text-xs text-slate-400 dark:text-slate-500">대기 중인 파일이 없습니다</p>
    </div>
  ) : (
    sortedDrops.map(drop => {
      const isNew = newIds.has(drop.id);
      const isUrgent = !!drop.is_urgent;
      const ext = extOf(drop.path);
      const waitMin = waitMinutes(drop.created_at);
      const longWait = waitMin >= 30;
      return (
        <div
          key={drop.id}
          className={`relative px-4 py-3 border-b last:border-b-0 transition ${
            isNew
              ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-100 dark:border-blue-900'
              : isUrgent
                ? 'bg-red-50/60 dark:bg-red-950/40 border-red-100 dark:border-red-900'
                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:bg-slate-50/60 dark:hover:bg-slate-800/60'
          }`}
        >
          {(isNew || isUrgent) && (
            <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${isUrgent ? 'bg-red-600' : 'bg-blue-600'}`} />
          )}
          <div className="flex items-start gap-1.5">
            {isNew && (
              <span className="inline-flex items-center h-4 px-1.5 rounded-sm bg-blue-600 text-white text-[9px] font-bold animate-pulse shrink-0 mt-0.5 select-none">
                NEW
              </span>
            )}
            {isUrgent && (
              <span className="inline-flex items-center gap-0.5 h-4 px-1.5 rounded-sm bg-red-600 text-white text-[9px] font-bold shrink-0 mt-0.5 select-none">
                <IconZap className="w-2.5 h-2.5" />
                급함
              </span>
            )}
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 break-all flex-1">{fileNameOf(drop.path)}</p>
            {ext && (
              <span className="inline-flex items-center h-4 px-1 rounded-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[9px] font-bold shrink-0 mt-0.5 select-none">
                {ext}
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 break-all mt-1 font-mono" title={drop.path}>{folderOf(drop.path)}</p>

          {/* 연결된 작업 카드 */}
          {drop.request_id && (() => {
            const linked = requests.find(rq => rq.id === drop.request_id);
            if (!linked) return null;
            return (
              <p className="flex items-center gap-1.5 mt-1.5">
                {linked.image_url && (
                  <img src={linked.image_url} className="w-10 h-7 object-cover rounded-sm border border-slate-200 dark:border-slate-600 shrink-0" alt="" />
                )}
                <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 truncate">
                  🔗 {linked.company} · {linked.program}
                </span>
              </p>
            );
          })()}

          {/* 요청 메모 */}
          {drop.note && (
            <p className="flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-400 mt-1.5">
              <IconFileText className="w-3 h-3 shrink-0" />
              <span className="truncate" title={drop.note}>{drop.note}</span>
            </p>
          )}

          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[10px] ${longWait ? 'text-red-600 dark:text-red-400 font-bold' : isNew ? 'text-blue-700 dark:text-blue-300' : 'text-slate-400'}`}>
              {drop.creator && <b className={`mr-1 font-semibold ${longWait ? 'text-red-700 dark:text-red-300' : isNew ? 'text-blue-800 dark:text-blue-200' : 'text-slate-500 dark:text-slate-400'}`}>{drop.creator}</b>}
              {longWait
                ? (waitMin < 60 ? `${waitMin}분째 대기` : `${Math.floor(waitMin / 60)}시간째 대기`)
                : relTime(drop.created_at)}
            </span>
            <span className="ml-auto flex gap-1">
              <button
                onClick={() => handleCopy(drop.id, drop.path)}
                title={`${drop.path}\n\n클릭하면 경로가 복사됩니다. 탐색기 주소창(Ctrl+L)에 붙여넣고 엔터를 누르면 파일이 열립니다.`}
                className={`inline-flex items-center gap-1 h-6 px-2 rounded text-[11px] font-medium border transition ${
                  copiedId === drop.id
                    ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                    : isNew
                      ? 'bg-white dark:bg-slate-900 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-950'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                {copiedId === drop.id ? <IconCheck className="w-3 h-3" /> : <IconCopy className="w-3 h-3" />}
                {copiedId === drop.id ? '복사됨' : '경로'}
              </button>
              <button
                onClick={() => handleRemove(drop)}
                title="출력 완료 (목록에서 제거 — 6초 내 실행 취소 가능)"
                className="inline-flex items-center gap-1 h-6 px-2 rounded text-[11px] font-medium border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition"
              >
                <IconCheck className="w-3 h-3" />
                완료
              </button>
            </span>
          </div>
        </div>
      );
    })
  );

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
            <span className="ml-auto">{soundToggleButton}</span>
          </div>
          {newAlertStrip}
          <div className="max-h-[50vh] overflow-y-auto">{listBody}</div>
          {undoBar}
        </div>
      </div>
    </>
  );
}
