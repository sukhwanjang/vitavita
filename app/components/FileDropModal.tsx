'use client';
import { useState } from 'react';
import { RequestItem } from './types';
import { IconX, IconUpload, IconZap, IconCheck } from './ui/icons';
import ThumbImg from './ui/ThumbImg';

// 탐색기 "경로로 복사"(Ctrl+Shift+C)로 붙여넣으면 따옴표가 붙어 오므로 제거
const cleanPath = (raw: string) => raw.trim().replace(/^"+|"+$/g, '');

interface FileDropModalProps {
  show: boolean;
  onClose: () => void;
  onAdd: (path: string, creator: string | null, urgent: boolean, note: string | null, requestId: number | null) => Promise<boolean>;
  cards?: RequestItem[]; // 진행 중인 작업 카드 (연결 선택용)
}

export default function FileDropModal({ show, onClose, onAdd, cards = [] }: FileDropModalProps) {
  const [input, setInput] = useState('');
  const [note, setNote] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [linkedId, setLinkedId] = useState<number | null>(null);

  if (!show) return null;

  // 경로에 업체명이 들어있으면 그 카드를 추천(맨 앞 정렬 + 배지)
  const path = cleanPath(input);
  const isMatch = (c: RequestItem) => !!c.company && path.includes(c.company);
  const sortedCards = [...cards].sort((a, b) => (isMatch(b) ? 1 : 0) - (isMatch(a) ? 1 : 0));
  const linkedCard = linkedId !== null ? cards.find(c => c.id === linkedId) : null;

  const handleAdd = async () => {
    if (!path || isAdding) return;
    setIsAdding(true);
    const creator = localStorage.getItem('vitavita_creator');
    const ok = await onAdd(path, creator, isUrgent, note.trim() || null, linkedId);
    setIsAdding(false);
    if (ok) {
      setInput('');
      setNote('');
      setIsUrgent(false);
      setLinkedId(null);
      onClose();
    }
  };

  const handleClose = () => {
    setInput('');
    setNote('');
    setIsUrgent(false);
    setLinkedId(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4">
      <div className="bg-white dark:bg-slate-900 rounded-md shadow-xl border border-slate-200 dark:border-slate-700 w-full max-w-lg relative animate-fadein">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h3 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
              <IconUpload className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              출력요청
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">작업 끝낸 파일의 위치를 공유합니다. 출력대기에 표시됩니다.</p>
          </div>
          <button
            className="flex items-center justify-center w-8 h-8 rounded text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition"
            onClick={handleClose}
            aria-label="닫기"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value.replace(/^"+|"+$/g, ''))}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            placeholder="\\NAS\출력\업체명\프로그램\파일.eps"
            autoFocus
            className="w-full rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 px-3.5 h-11 text-sm font-mono text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
          />
          <p className="text-xs text-slate-400 mt-2">
            탐색기에서 파일 선택 → <b className="text-slate-600 dark:text-slate-300">Ctrl+Shift+C</b> (경로로 복사) → 여기에 <b className="text-slate-600 dark:text-slate-300">Ctrl+V</b>
          </p>

          {/* 작업 카드 연결 (선택) */}
          {cards.length > 0 && (
            <div className="mt-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[13px] font-semibold text-slate-600 dark:text-slate-300">작업 연결 <span className="text-slate-400 font-normal text-xs">(선택)</span></span>
                {path && sortedCards.some(isMatch) && (
                  <span className="text-[10px] font-bold bg-amber-400 text-amber-950 rounded px-1.5 py-0.5">경로에서 업체명 발견 → 추천</span>
                )}
                {linkedCard && (
                  <span className="ml-auto text-[11px] font-bold text-blue-600 dark:text-blue-400 truncate">
                    🔗 {linkedCard.company} · {linkedCard.program}
                  </span>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1.5">
                {sortedCards.slice(0, 12).map(c => {
                  const selected = linkedId === c.id;
                  const rec = isMatch(c);
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setLinkedId(prev => (prev === c.id ? null : c.id))}
                      title={selected ? '클릭하면 연결 해제' : '이 작업에 연결'}
                      className={`relative shrink-0 w-[118px] rounded-md overflow-hidden border-2 text-left transition ${
                        selected
                          ? 'border-blue-500 ring-2 ring-blue-500/30'
                          : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600'
                      }`}
                    >
                      {rec && (
                        <span className="absolute top-1 left-1 z-10 text-[9px] font-black bg-amber-400 text-amber-950 rounded px-1 py-0.5">추천</span>
                      )}
                      {selected && (
                        <span className="absolute top-1 right-1 z-10 flex items-center justify-center w-[18px] h-[18px] rounded-full bg-blue-600 text-white">
                          <IconCheck className="w-3 h-3" />
                        </span>
                      )}
                      <span className="block h-[54px] bg-slate-800">
                        {c.image_url ? (
                          <ThumbImg src={c.image_url} className="w-full h-full object-cover opacity-90" alt="" />
                        ) : (
                          <span className="flex items-center justify-center h-full text-white/20 text-xl font-black select-none">{c.company?.[0] ?? '?'}</span>
                        )}
                      </span>
                      <span className="block px-2 py-1 bg-white dark:bg-slate-800">
                        <span className="block text-[11px] font-bold text-slate-900 dark:text-slate-100 truncate">{c.company}</span>
                        <span className="block text-[10px] text-slate-400 truncate">{c.program}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 요청 메모 + 급함 */}
          <div className="flex gap-2 mt-4">
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
              placeholder="요청 메모 (예: 3장, 유포지) — 선택"
              className="flex-1 rounded border border-slate-300 dark:border-slate-600 dark:bg-slate-800 px-3.5 h-10 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
            />
            <button
              type="button"
              onClick={() => setIsUrgent(!isUrgent)}
              title="긴급 출력 (목록 맨 위에 빨간색으로 고정)"
              className={`shrink-0 inline-flex items-center gap-1.5 h-10 px-3.5 rounded border text-sm font-semibold transition ${
                isUrgent
                  ? 'bg-red-600 text-white border-red-600'
                  : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-red-300 hover:text-red-600 dark:hover:text-red-400'
              }`}
            >
              <IconZap className="w-3.5 h-3.5" />
              급함
            </button>
          </div>
        </div>

        {/* 모달 푸터 */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 rounded-b-md">
          <button
            onClick={handleClose}
            className="h-10 px-5 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
          >
            취소
          </button>
          <button
            onClick={handleAdd}
            disabled={isAdding || !cleanPath(input)}
            className="h-10 px-6 rounded bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800 transition disabled:bg-slate-300"
          >
            {isAdding ? '올리는 중...' : '올리기'}
          </button>
        </div>
      </div>
    </div>
  );
}
