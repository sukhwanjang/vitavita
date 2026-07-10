'use client';
import { useState, useEffect, useRef } from 'react';
import { FileDrop } from './types';
import { IconInbox, IconCopy, IconCheck, IconChevronLeft, IconChevronRight, IconBell } from './ui/icons';

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

// 헤더(앱바 64px + 탭 44px + 보더 1px) 아래에 고정
const HEADER_OFFSET = 109;

interface FileSidebarProps {
  drops: FileDrop[];
  error: string | null;
  onRemove: (id: number) => void;
  open: boolean;
  onToggle: () => void;
  onOpen: () => void;
}

export default function FileSidebar({ drops, error, onRemove, open, onToggle, onOpen }: FileSidebarProps) {
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [lastSeenDropId, setLastSeenDropId] = useState<number | null>(null);
  const prevMaxIdRef = useRef<number | null>(null);

  // 마지막으로 확인한 파일 id 불러오기 (-1 = 첫 방문)
  useEffect(() => {
    const stored = localStorage.getItem('vitavita_last_seen_drop_id');
    setLastSeenDropId(stored !== null ? Number(stored) : -1);
  }, []);

  // 첫 방문이면 현재 파일까지 확인한 것으로 조용히 초기화 (전부 NEW로 뜨는 것 방지)
  useEffect(() => {
    if (lastSeenDropId === -1 && drops.length > 0) {
      const maxId = Math.max(...drops.map(d => d.id));
      localStorage.setItem('vitavita_last_seen_drop_id', String(maxId));
      setLastSeenDropId(maxId);
    }
  }, [lastSeenDropId, drops]);

  // 내가 올린 파일은 나에게 새 파일로 알리지 않는다
  const myName = typeof window !== 'undefined' ? localStorage.getItem('vitavita_creator') : null;
  const newIds = new Set(
    lastSeenDropId !== null && lastSeenDropId >= 0
      ? drops.filter(d => d.id > lastSeenDropId && d.creator !== myName).map(d => d.id)
      : []
  );
  const newCount = newIds.size;

  const markAllSeen = () => {
    if (drops.length === 0) return;
    const maxId = Math.max(...drops.map(d => d.id));
    localStorage.setItem('vitavita_last_seen_drop_id', String(maxId));
    setLastSeenDropId(maxId);
  };

  // 다른 사람이 올린 새 파일이 도착하면 접혀 있어도 자동으로 펼친다
  useEffect(() => {
    const maxId = drops.length > 0 ? Math.max(...drops.map(d => d.id)) : 0;
    if (prevMaxIdRef.current === null) {
      prevMaxIdRef.current = maxId;
      return;
    }
    if (maxId > prevMaxIdRef.current) {
      const newest = drops.find(d => d.id === maxId);
      prevMaxIdRef.current = maxId;
      if (newest && newest.creator !== myName && !open) onOpen();
    }
  }, [drops, myName, open, onOpen]);

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

  const handleRemove = (id: number) => {
    if (!window.confirm('처리 완료! 목록에서 지울까요?')) return;
    onRemove(id);
  };

  const panelHeader = (
    <div className="flex items-center gap-2 px-4 h-11 border-b border-slate-200 bg-slate-50 shrink-0">
      <IconInbox className="w-4 h-4 text-slate-500" />
      <h2 className="font-semibold text-slate-800 text-[13px]">파일 대기함</h2>
      {drops.length > 0 && (
        <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-slate-200 text-slate-600 text-[11px] font-bold">
          {drops.length}
        </span>
      )}
    </div>
  );

  const newAlertStrip = newCount > 0 && (
    <div className="flex items-center gap-1.5 px-3 h-9 bg-blue-600 text-white text-xs font-semibold shrink-0">
      <IconBell className="w-3.5 h-3.5 animate-pulse shrink-0" />
      <span>새 파일 {newCount}건 도착</span>
      <button
        onClick={markAllSeen}
        className="ml-auto h-6 px-2 rounded bg-white/20 hover:bg-white/30 text-[11px] font-semibold transition"
      >
        모두 확인
      </button>
    </div>
  );

  const listBody = error ? (
    <p className="p-4 text-xs text-red-500">
      파일 대기함을 불러올 수 없습니다.<br />({error})
    </p>
  ) : drops.length === 0 ? (
    <div className="flex flex-col items-center gap-2 p-8 text-slate-300">
      <IconInbox className="w-7 h-7" />
      <p className="text-xs text-slate-400">대기 중인 파일이 없습니다</p>
    </div>
  ) : (
    drops.map(drop => {
      const isNew = newIds.has(drop.id);
      const ext = extOf(drop.path);
      return (
        <div
          key={drop.id}
          className={`relative px-4 py-3 border-b last:border-b-0 transition ${
            isNew
              ? 'bg-blue-50 border-blue-100'
              : 'bg-white border-slate-100 hover:bg-slate-50/60'
          }`}
        >
          {isNew && <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-blue-600" />}
          <div className="flex items-start gap-1.5">
            {isNew && (
              <span className="inline-flex items-center h-4 px-1.5 rounded-sm bg-blue-600 text-white text-[9px] font-bold animate-pulse shrink-0 mt-0.5 select-none">
                NEW
              </span>
            )}
            <p className="text-xs font-semibold text-slate-900 break-all flex-1">{fileNameOf(drop.path)}</p>
            {ext && (
              <span className="inline-flex items-center h-4 px-1 rounded-sm bg-slate-100 border border-slate-200 text-slate-500 text-[9px] font-bold shrink-0 mt-0.5 select-none">
                {ext}
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 break-all mt-1 font-mono" title={drop.path}>{folderOf(drop.path)}</p>
          <div className="flex items-center gap-2 mt-2">
            <span className={`text-[10px] ${isNew ? 'text-blue-700' : 'text-slate-400'}`}>
              {drop.creator && <b className={`mr-1 font-semibold ${isNew ? 'text-blue-800' : 'text-slate-500'}`}>{drop.creator}</b>}
              {relTime(drop.created_at)}
            </span>
            <span className="ml-auto flex gap-1">
              <button
                onClick={() => handleCopy(drop.id, drop.path)}
                title={`${drop.path}\n\n클릭하면 경로가 복사됩니다. 탐색기 주소창(Ctrl+L)에 붙여넣고 엔터를 누르면 파일이 열립니다.`}
                className={`inline-flex items-center gap-1 h-6 px-2 rounded text-[11px] font-medium border transition ${
                  copiedId === drop.id
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : isNew
                      ? 'bg-white border-blue-300 text-blue-700 hover:bg-blue-100'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                {copiedId === drop.id ? <IconCheck className="w-3 h-3" /> : <IconCopy className="w-3 h-3" />}
                {copiedId === drop.id ? '복사됨' : '경로 복사'}
              </button>
              <button
                onClick={() => handleRemove(drop.id)}
                title="처리 완료 (목록에서 제거)"
                className="inline-flex items-center h-6 px-2 rounded text-[11px] font-medium border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition"
              >
                확인
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
        className={`hidden lg:flex flex-col fixed left-0 bottom-0 z-30 bg-white border-r transition-all duration-200 ${
          open ? 'w-72' : 'w-12'
        } ${newCount > 0 ? 'border-blue-300' : 'border-slate-200'}`}
        style={{ top: HEADER_OFFSET }}
      >
        {open ? (
          <>
            <div className="flex items-center gap-2 px-4 h-11 border-b border-slate-200 bg-slate-50 shrink-0">
              <IconInbox className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-800 text-[13px]">파일 대기함</h2>
              {drops.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-slate-200 text-slate-600 text-[11px] font-bold">
                  {drops.length}
                </span>
              )}
              <button
                onClick={onToggle}
                title="접기"
                className="ml-auto flex items-center justify-center w-6 h-6 rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
              >
                <IconChevronLeft className="w-4 h-4" />
              </button>
            </div>
            {newAlertStrip}
            <div className="flex-1 overflow-y-auto">{listBody}</div>
          </>
        ) : (
          <button
            onClick={onToggle}
            title="파일 대기함 열기"
            className={`flex flex-col items-center gap-3 pt-4 w-full h-full transition ${
              newCount > 0 ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-slate-50'
            }`}
          >
            <IconChevronRight className="w-4 h-4 text-slate-400" />
            <IconInbox className={`w-4 h-4 ${newCount > 0 ? 'text-blue-600' : 'text-slate-500'}`} />
            {newCount > 0 ? (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-blue-600 text-white text-[11px] font-bold animate-pulse">
                {newCount}
              </span>
            ) : drops.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-slate-200 text-slate-600 text-[11px] font-bold">
                {drops.length}
              </span>
            )}
          </button>
        )}
      </aside>

      {/* 모바일: 본문 흐름 안의 인라인 패널 */}
      <div className="lg:hidden w-full">
        <div className={`bg-white rounded border overflow-hidden ${newCount > 0 ? 'border-blue-300' : 'border-slate-200'}`}>
          {panelHeader}
          {newAlertStrip}
          <div className="max-h-[50vh] overflow-y-auto">{listBody}</div>
        </div>
      </div>
    </>
  );
}
