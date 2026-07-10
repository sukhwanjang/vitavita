'use client';
import { useState } from 'react';
import { FileDrop } from './types';
import { IconInbox, IconCopy, IconCheck, IconChevronLeft, IconChevronRight } from './ui/icons';

const fileNameOf = (path: string) => path.split('\\').pop()?.split('/').pop() ?? path;
const folderOf = (path: string) => {
  const name = fileNameOf(path);
  return path.slice(0, path.length - name.length).replace(/[\\/]+$/, '');
};

// 헤더(앱바 64px + 탭 44px + 보더 1px) 아래에 고정
const HEADER_OFFSET = 109;

interface FileSidebarProps {
  drops: FileDrop[];
  error: string | null;
  onRemove: (id: number) => void;
  open: boolean;
  onToggle: () => void;
}

export default function FileSidebar({ drops, error, onRemove, open, onToggle }: FileSidebarProps) {
  const [copiedId, setCopiedId] = useState<number | null>(null);

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

  const listBody = error ? (
    <p className="p-4 text-xs text-red-500">
      파일 대기함을 불러올 수 없습니다.<br />({error})
    </p>
  ) : drops.length === 0 ? (
    <p className="p-6 text-xs text-slate-400 text-center">대기 중인 파일이 없습니다</p>
  ) : (
    drops.map(drop => (
      <div key={drop.id} className="px-4 py-3 border-b border-slate-100 last:border-b-0 hover:bg-slate-50/60 transition">
        <p className="text-xs font-semibold text-slate-900 break-all">{fileNameOf(drop.path)}</p>
        <p className="text-[10px] text-slate-400 break-all mt-0.5 font-mono" title={drop.path}>{folderOf(drop.path)}</p>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] text-slate-400">
            {drop.creator && <b className="mr-1 font-semibold text-slate-500">{drop.creator}</b>}
            {new Date(drop.created_at).toLocaleString('ko-KR', {
              month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
            })}
          </span>
          <span className="ml-auto flex gap-1">
            <button
              onClick={() => handleCopy(drop.id, drop.path)}
              title={`${drop.path}\n\n클릭하면 경로가 복사됩니다. 탐색기 주소창(Ctrl+L)에 붙여넣고 엔터를 누르면 파일이 열립니다.`}
              className={`inline-flex items-center gap-1 h-6 px-2 rounded text-[11px] font-medium border transition ${
                copiedId === drop.id
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
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
    ))
  );

  return (
    <>
      {/* 데스크톱: 화면 좌측에 고정된 패널 */}
      <aside
        className={`hidden lg:flex flex-col fixed left-0 bottom-0 z-30 bg-white border-r border-slate-200 transition-all duration-200 ${open ? 'w-72' : 'w-12'}`}
        style={{ top: HEADER_OFFSET }}
      >
        {open ? (
          <>
            <div className="flex items-center gap-2 px-4 h-11 border-b border-slate-200 bg-slate-50 shrink-0">
              <IconInbox className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-800 text-[13px]">파일 대기함</h2>
              {drops.length > 0 && (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] font-bold">
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
            <div className="flex-1 overflow-y-auto">{listBody}</div>
          </>
        ) : (
          <button
            onClick={onToggle}
            title="파일 대기함 열기"
            className="flex flex-col items-center gap-3 pt-4 w-full h-full hover:bg-slate-50 transition"
          >
            <IconChevronRight className="w-4 h-4 text-slate-400" />
            <IconInbox className="w-4 h-4 text-slate-500" />
            {drops.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full bg-blue-600 text-white text-[11px] font-bold">
                {drops.length}
              </span>
            )}
          </button>
        )}
      </aside>

      {/* 모바일: 본문 흐름 안의 인라인 패널 */}
      <div className="lg:hidden w-full">
        <div className="bg-white rounded border border-slate-200 overflow-hidden">
          <div className="flex items-center gap-2 bg-slate-50 px-4 h-11 border-b border-slate-200">
            <IconInbox className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-800 text-[13px]">파일 대기함</h2>
            {drops.length > 0 && (
              <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-blue-600 text-white text-[11px] font-bold">
                {drops.length}
              </span>
            )}
          </div>
          <div className="max-h-[50vh] overflow-y-auto">{listBody}</div>
        </div>
      </div>
    </>
  );
}
