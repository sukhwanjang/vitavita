'use client';
import { useState } from 'react';
import { FileDrop, RequestItem } from './types';
import { IconInbox, IconCopy, IconCheck, IconZap, IconFileText } from './ui/icons';

// 출력대기 목록 본문 — 사이드바(FileSidebar)와 전용 화면(/queue)에서 공용
export const fileNameOf = (path: string) => path.split('\\').pop()?.split('/').pop() ?? path;
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

interface DropListProps {
  drops: FileDrop[];
  error: string | null;
  requests?: RequestItem[];        // 연결된 작업 카드 표시용
  newIds: Set<number>;
  onRemove: (drop: FileDrop) => void;
  onImageClick?: (item: RequestItem) => void;
  large?: boolean;                 // 전용 화면용 큰 글씨
}

export default function DropList({
  drops,
  error,
  requests = [],
  newIds,
  onRemove,
  onImageClick,
  large = false,
}: DropListProps) {
  const [copiedId, setCopiedId] = useState<number | null>(null);

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

  // 크기 프리셋 (전용 화면은 한 단계 크게)
  const padCls = large ? 'px-5 py-3.5' : 'px-4 py-3';
  const titleCls = large ? 'text-sm' : 'text-xs';
  const pathCls = large ? 'text-[11px]' : 'text-[10px]';
  const metaCls = large ? 'text-[11px]' : 'text-[10px]';
  const btnCls = large ? 'h-7 px-2.5 text-xs' : 'h-6 px-2 text-[11px]';

  if (error) {
    return (
      <p className="p-4 text-xs text-red-500">
        출력대기를 불러올 수 없습니다.<br />({error})
      </p>
    );
  }

  if (sortedDrops.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 p-8 text-slate-300 dark:text-slate-600">
        <IconInbox className="w-7 h-7" />
        <p className="text-xs text-slate-400 dark:text-slate-500">대기 중인 파일이 없습니다</p>
      </div>
    );
  }

  return (
    <>
      {sortedDrops.map(drop => {
        const isNew = newIds.has(drop.id);
        const isUrgent = !!drop.is_urgent;
        const ext = extOf(drop.path);
        const waitMin = waitMinutes(drop.created_at);
        const longWait = waitMin >= 30;
        return (
          <div
            key={drop.id}
            className={`relative ${padCls} border-b last:border-b-0 transition ${
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
              <p className={`${titleCls} font-semibold text-slate-900 dark:text-slate-100 break-all flex-1`}>{fileNameOf(drop.path)}</p>
              {ext && (
                <span className="inline-flex items-center h-4 px-1 rounded-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-[9px] font-bold shrink-0 mt-0.5 select-none">
                  {ext}
                </span>
              )}
            </div>
            <p className={`${pathCls} text-slate-400 break-all mt-1 font-mono`} title={drop.path}>{folderOf(drop.path)}</p>

            {/* 연결된 작업 카드 */}
            {drop.request_id && (() => {
              const linked = requests.find(rq => rq.id === drop.request_id);
              if (!linked) return null;
              return (
                <p className="flex items-center gap-1.5 mt-1.5">
                  {linked.image_url && (
                    <button
                      onClick={() => onImageClick?.(linked)}
                      title="클릭하면 원고를 크게 봅니다"
                      className="shrink-0 rounded-sm overflow-hidden border border-slate-200 dark:border-slate-600 hover:ring-2 hover:ring-blue-400 transition"
                    >
                      <img src={linked.image_url} className={`${large ? 'w-12 h-8' : 'w-10 h-7'} object-cover block`} alt="" />
                    </button>
                  )}
                  <span className={`${metaCls} font-bold text-blue-700 dark:text-blue-300 truncate`}>
                    🔗 {linked.company} · {linked.program}
                  </span>
                </p>
              );
            })()}

            {/* 요청 메모 */}
            {drop.note && (
              <p className={`flex items-center gap-1 ${metaCls} text-amber-700 dark:text-amber-400 mt-1.5`}>
                <IconFileText className="w-3 h-3 shrink-0" />
                <span className="truncate" title={drop.note}>{drop.note}</span>
              </p>
            )}

            <div className="flex items-center gap-2 mt-2">
              <span className={`${metaCls} ${longWait ? 'text-red-600 dark:text-red-400 font-bold' : isNew ? 'text-blue-700 dark:text-blue-300' : 'text-slate-400'}`}>
                {drop.creator && <b className={`mr-1 font-semibold ${longWait ? 'text-red-700 dark:text-red-300' : isNew ? 'text-blue-800 dark:text-blue-200' : 'text-slate-500 dark:text-slate-400'}`}>{drop.creator}</b>}
                {longWait
                  ? (waitMin < 60 ? `${waitMin}분째 대기` : `${Math.floor(waitMin / 60)}시간째 대기`)
                  : relTime(drop.created_at)}
              </span>
              <span className="ml-auto flex gap-1">
                <button
                  onClick={() => handleCopy(drop.id, drop.path)}
                  title={`${drop.path}\n\n클릭하면 경로가 복사됩니다. 탐색기 주소창(Ctrl+L)에 붙여넣고 엔터를 누르면 파일이 열립니다.`}
                  className={`inline-flex items-center gap-1 ${btnCls} rounded font-medium border transition ${
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
                  onClick={() => onRemove(drop)}
                  title="출력 완료 (목록에서 제거 — 6초 내 실행 취소 가능)"
                  className={`inline-flex items-center gap-1 ${btnCls} rounded font-medium border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950 transition`}
                >
                  <IconCheck className="w-3 h-3" />
                  완료
                </button>
              </span>
            </div>
          </div>
        );
      })}
    </>
  );
}
