'use client';
import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { useNotices, type Notice } from './hooks/useNotices';
import { IconBell, IconEdit, IconX, IconTrash, IconLock } from './ui/icons';

// ─────────────────────────────────────────────────
// 공지 띠
//  - 공지가 있으면 빨간 굵은 글씨가 오른쪽에서 왼쪽으로 계속 흘러간다 (마우스를 올리면 멈춤)
//  - 띠(또는 왼쪽 메뉴의 공지 버튼)를 누르면 비밀번호를 묻고, 맞으면 공지를 적고·고치고·지울 수 있다
//  - 공지가 하나도 없으면 띠는 보이지 않는다
// ─────────────────────────────────────────────────

// 공지 수정 비밀번호 — 아무나 실수로 고치지 않게 하는 가벼운 잠금 (사장님이 정한 번호)
const NOTICE_PW = '0000';
const MAX_LEN = 200;

interface Props {
  /** 값이 바뀔 때마다 수정 창(비밀번호 확인부터)을 연다 — 왼쪽 메뉴의 공지 버튼용 */
  openSignal?: number;
  /** 띠를 감싸는 상자에 줄 클래스 (화면마다 붙는 위치가 달라서 부모가 정한다) */
  className?: string;
}

export default function NoticeTicker({ openSignal = 0, className = '' }: Props) {
  const { items, loaded, tableMissing, add, update, remove } = useNotices();

  // 'closed' → 'password'(비밀번호 확인) → 'edit'(수정 창)
  const [stage, setStage] = useState<'closed' | 'password' | 'edit'>('closed');
  const [pw, setPw] = useState('');
  const [pwError, setPwError] = useState(false);

  // 왼쪽 메뉴의 공지 버튼을 누르면 열기 (처음 그려질 때는 열지 않는다)
  const firstSignal = useRef(openSignal);
  useEffect(() => {
    if (openSignal !== firstSignal.current) {
      firstSignal.current = openSignal;
      openEditor();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSignal]);

  const openEditor = () => {
    setPw('');
    setPwError(false);
    setStage('password');
  };
  const closeAll = () => setStage('closed');

  const submitPw = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw === NOTICE_PW) {
      setStage('edit');
    } else {
      setPwError(true);
      setPw('');
    }
  };

  // ESC로 닫기
  useEffect(() => {
    if (stage === 'closed') return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAll(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage]);

  // 띠 너비 — 글이 짧아도 한 바퀴가 화면 폭만큼은 되게 해서 끊김 없이 이어 붙인다
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxW, setBoxW] = useState(0);
  const hasNotices = items.length > 0;
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    setBoxW(el.clientWidth);
    const ro = new ResizeObserver(entries => setBoxW(entries[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [hasNotices]);

  // 글이 길수록 한 바퀴 도는 시간을 늘려 읽는 속도를 비슷하게 맞춘다
  const totalChars = items.reduce((n, it) => n + it.message.length, 0);
  const duration = Math.min(120, Math.max(16, Math.round(totalChars * 0.3 + boxW / 60)));

  const group = (hidden: boolean) => (
    <div
      className="flex shrink-0 items-center justify-around"
      style={{ minWidth: boxW || undefined }}
      aria-hidden={hidden || undefined}
    >
      {items.map(it => (
        <span key={it.id} className="px-10 whitespace-nowrap">
          <span className="mr-3 text-red-400 dark:text-red-500" aria-hidden>◆</span>
          {it.message}
        </span>
      ))}
    </div>
  );

  return (
    <>
      {hasNotices && (
        <div className={className}>
          <div className="notice-ticker flex items-stretch h-10 bg-red-50 dark:bg-red-950/50 border-y border-red-200 dark:border-red-900">
            <button
              onClick={openEditor}
              title="공지 수정 (비밀번호 필요)"
              className="flex items-center gap-1.5 px-3.5 bg-red-600 hover:bg-red-700 text-white text-[13px] font-extrabold whitespace-nowrap shrink-0 transition"
            >
              <IconBell className="w-4 h-4" />
              공지
            </button>
            <div ref={boxRef} className="relative flex-1 min-w-0 overflow-hidden flex items-center">
              <div
                className="notice-track text-[15px] font-extrabold text-red-600 dark:text-red-400"
                style={{ '--notice-duration': `${duration}s` } as CSSProperties}
              >
                {group(false)}
                {group(true)}
              </div>
            </div>
            <button
              onClick={openEditor}
              title="공지 수정 (비밀번호 필요)"
              aria-label="공지 수정"
              className="flex items-center justify-center w-10 shrink-0 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 border-l border-red-200 dark:border-red-900 transition"
            >
              <IconEdit className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 비밀번호 확인 */}
      {stage === 'password' && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-brand/60 backdrop-blur-sm p-4" onClick={closeAll}>
          <form
            onSubmit={submitPw}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-xs bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 animate-fadein"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400">
                <IconLock className="w-4 h-4" />
              </span>
              <h3 className="text-base font-extrabold text-brand dark:text-slate-100">공지 수정</h3>
            </div>
            <p className="text-xs text-slate-400 mb-4">비밀번호를 입력하면 공지를 적거나 고칠 수 있습니다.</p>
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              value={pw}
              onChange={e => { setPw(e.target.value); setPwError(false); }}
              placeholder="비밀번호"
              className={`w-full h-11 px-3.5 rounded-lg border text-center text-lg tracking-[0.4em] dark:bg-slate-800 text-slate-900 dark:text-slate-100 ${
                pwError ? 'border-red-400 bg-red-50/60 dark:bg-red-950/30' : 'border-slate-300 dark:border-slate-600'
              }`}
            />
            {pwError && <p className="mt-2 text-[13px] font-semibold text-red-600 dark:text-red-400">비밀번호가 맞지 않습니다.</p>}
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={closeAll}
                className="flex-1 h-10 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
              >
                취소
              </button>
              <button
                type="submit"
                className="flex-1 h-10 rounded-lg bg-brand dark:bg-blue-600 text-sm font-bold text-white hover:bg-brand-soft dark:hover:bg-blue-500 transition"
              >
                확인
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 공지 수정 창 */}
      {stage === 'edit' && (
        <NoticeEditor
          items={items}
          loaded={loaded}
          tableMissing={tableMissing}
          onAdd={add}
          onUpdate={update}
          onRemove={remove}
          onClose={closeAll}
        />
      )}
    </>
  );
}

function NoticeEditor({
  items, loaded, tableMissing, onAdd, onUpdate, onRemove, onClose,
}: {
  items: Notice[];
  loaded: boolean;
  tableMissing: boolean;
  onAdd: (message: string, by: string | null) => Promise<string | null>;
  onUpdate: (id: number, message: string) => Promise<string | null>;
  onRemove: (id: number) => Promise<string | null>;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [drafts, setDrafts] = useState<Record<number, string>>({}); // 고치는 중인 글 (저장 전)
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (job: () => Promise<string | null>) => {
    if (busy) return false;
    setBusy(true);
    const err = await job();
    setBusy(false);
    setError(err ? `저장 실패: ${err}` : null);
    return !err;
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    const by = localStorage.getItem('vitavita_creator');
    if (await run(() => onAdd(text, by))) setText('');
  };

  const handleSave = async (id: number) => {
    const draft = drafts[id];
    if (draft === undefined) return;
    if (await run(() => onUpdate(id, draft))) {
      setDrafts(prev => { const next = { ...prev }; delete next[id]; return next; });
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-brand/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="w-full max-w-xl max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 animate-fadein"
      >
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-100 dark:bg-red-950 text-red-600 dark:text-red-400">
            <IconBell className="w-5 h-5" />
          </span>
          <div>
            <h3 className="text-lg font-extrabold tracking-tight text-brand dark:text-slate-100">공지 수정</h3>
            <p className="text-xs text-slate-400 mt-0.5">여기 적은 글이 모든 현황판 위에 빨간 글씨로 계속 흘러갑니다.</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto flex items-center justify-center w-9 h-9 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition"
            aria-label="닫기"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        {tableMissing ? (
          <div className="px-6 py-5 text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30">
            공지를 저장할 자리가 아직 없습니다. Supabase SQL Editor에서 저장소의 <b>notice_setup.sql</b>을 한 번 실행해 주세요.
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
              {!loaded && <p className="text-sm text-slate-400">불러오는 중…</p>}
              {loaded && items.length === 0 && (
                <p className="py-4 text-center text-sm text-slate-400">지금은 공지가 없습니다. 아래에 적어서 추가하세요.</p>
              )}
              {items.map(it => {
                const draft = drafts[it.id];
                const changed = draft !== undefined && draft.trim() !== it.message;
                return (
                  <div key={it.id} className="flex items-center gap-2">
                    <input
                      value={draft ?? it.message}
                      maxLength={MAX_LEN}
                      onChange={e => setDrafts(prev => ({ ...prev, [it.id]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.nativeEvent.isComposing && changed) handleSave(it.id); }}
                      className="flex-1 min-w-0 h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-sm font-semibold text-red-600 dark:text-red-400"
                    />
                    {changed && (
                      <button
                        onClick={() => handleSave(it.id)}
                        disabled={busy}
                        className="shrink-0 h-10 px-3 rounded-lg bg-brand dark:bg-blue-600 text-xs font-bold text-white hover:bg-brand-soft dark:hover:bg-blue-500 transition disabled:opacity-50"
                      >
                        저장
                      </button>
                    )}
                    <button
                      onClick={() => run(() => onRemove(it.id))}
                      disabled={busy}
                      title="이 공지 내리기"
                      aria-label="이 공지 내리기"
                      className="shrink-0 flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-400 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 transition disabled:opacity-50"
                    >
                      <IconTrash className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            <form onSubmit={handleAdd} className="flex items-center gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 rounded-b-2xl shrink-0">
              <input
                value={text}
                maxLength={MAX_LEN}
                autoFocus
                onChange={e => setText(e.target.value)}
                placeholder="새 공지를 적고 엔터"
                className="flex-1 min-w-0 h-11 px-3.5 rounded-lg border border-slate-300 dark:border-slate-600 dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={busy || !text.trim()}
                className="shrink-0 h-11 px-5 rounded-lg bg-red-600 hover:bg-red-700 text-sm font-extrabold text-white shadow-sm transition disabled:opacity-40"
              >
                공지 올리기
              </button>
            </form>
          </>
        )}

        {error && <p className="px-6 pb-4 text-[13px] font-semibold text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  );
}
