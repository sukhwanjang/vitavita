'use client';
import { useState, useEffect, useRef, type MutableRefObject } from 'react';
import { useBroadcasts, getClientId, type Broadcast } from './hooks/useBroadcasts';
import { IconX, IconVolume } from './ui/icons';

// ─────────────────────────────────────────────────────────────
// 층간 방송(확성기)
//  - 아래쪽 가운데 📢 버튼 → 패널에서 말을 쳐서 보내면
//  - 켜져 있는 다른 현황판 화면이 "띵동" + 음성으로 읽어주고 큰 배너로 띄움
//  - 받은 쪽이 [확인했어요]를 누르면 보낸 쪽 목록에 확인한 사람이 표시됨
// ─────────────────────────────────────────────────────────────

interface Props {
  audioCtxRef: MutableRefObject<AudioContext | null>;
  soundOn: boolean;
}

// 자주 쓰는 말 — 버튼 한 번으로 바로 방송
const QUICK_PHRASES = [
  '파일 넘겼어요',
  '올라와 주세요',
  '내려와 주세요',
  '출력 끝났어요',
  '전화 왔어요',
  '잠깐만요',
];

const SPEAK_REPEAT = 2;          // 음성 반복 횟수 (작업장 소음 대비)
const BANNER_MAX_AGE_MS = 30 * 60 * 1000; // 30분 지난 방송은 배너로 안 띄움
const ANNOUNCE_MAX_AGE_MS = 10 * 60 * 1000; // 10분 지난 방송은 소리로 안 알림 (늦게 켠 화면에서 옛 방송 재생 방지)
const HEARD_KEY = 'vitavita_bc_heard_id'; // 이 브라우저가 마지막으로 들은 방송 id (새로고침해도 다시 안 울리게)

const timeLabel = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

// 방송 차임 — 출력요청 알림음보다 길고 큰 3음
const playBroadcastChime = (ctx: AudioContext) => {
  try {
    if (ctx.state === 'suspended') ctx.resume();
    const tone = (freq: number, start: number, dur: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = 'triangle';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      g.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + start + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      o.start(ctx.currentTime + start);
      o.stop(ctx.currentTime + start + dur);
    };
    tone(659.25, 0, 0.4);     // 미
    tone(830.61, 0.25, 0.4);  // 솔#
    tone(987.77, 0.5, 0.7);   // 시
  } catch {
    // 오디오 차단 환경은 조용히 무시
  }
};

// 한국어 음성으로 읽기 (브라우저 내장 TTS, 무료)
const pickKoreanVoice = () => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find(v => /ko[-_]KR/i.test(v.lang) && /Heami|Google|Natural|SunHi|InJoon/i.test(v.name)) ||
    voices.find(v => /^ko/i.test(v.lang)) ||
    null
  );
};

const speak = (text: string, repeat = SPEAK_REPEAT) => {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const voice = pickKoreanVoice();
    for (let i = 0; i < repeat; i++) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ko-KR';
      if (voice) u.voice = voice;
      u.rate = 0.95;
      u.pitch = 1;
      u.volume = 1;
      synth.speak(u);
    }
  } catch {
    // TTS 미지원은 조용히 무시 (차임과 배너는 그대로 동작)
  }
};

export default function BroadcastPanel({ audioCtxRef, soundOn }: Props) {
  const { items, loaded, tableMissing, error, send, ack } = useBroadcasts();
  const clientId = getClientId();

  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [myName, setMyName] = useState('');
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());
  const [ackToast, setAckToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const heardIdRef = useRef<number | null>(null);
  const prevAckedRef = useRef<Set<number> | null>(null);
  const ackToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 패널 열림 상태 / 내 이름 복원
  useEffect(() => {
    setOpen(localStorage.getItem('vitavita_bc_open') === '1');
    setMyName(localStorage.getItem('vitavita_creator') ?? '');
    // 음성 목록은 비동기로 준비됨 — 미리 한 번 불러둠
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }, []);

  const toggleOpen = () => {
    setOpen(prev => {
      localStorage.setItem('vitavita_bc_open', prev ? '0' : '1');
      return !prev;
    });
  };

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  const saveName = (v: string) => {
    setMyName(v);
    localStorage.setItem('vitavita_creator', v.trim());
  };

  // ── 새 방송 도착 감지 → 차임 + 음성 ──
  // 한 번 울린 방송은 id를 브라우저에 저장해 두고, 그보다 새 방송만 울린다.
  // (예전엔 새로고침·재접속마다 마지막 방송을 또 읽어서 "퇴근하세요"가 다음 날까지 울렸음)
  useEffect(() => {
    if (!loaded) return; // 첫 조회 전의 빈 목록을 기준으로 잡지 않도록
    const maxId = items.length > 0 ? Math.max(...items.map(b => b.id)) : 0;

    if (heardIdRef.current === null) {
      const stored = localStorage.getItem(HEARD_KEY);
      if (stored !== null) {
        heardIdRef.current = Number(stored);
      } else {
        // 이 브라우저에서 처음 켬: 지금 있는 방송까지는 들은 것으로 (조용히 시작)
        heardIdRef.current = maxId;
        localStorage.setItem(HEARD_KEY, String(maxId));
        return;
      }
    }

    if (maxId > heardIdRef.current) {
      const since = heardIdRef.current;
      heardIdRef.current = maxId;
      localStorage.setItem(HEARD_KEY, String(maxId));

      // 울릴 대상: 남이 보낸 것 · 아직 확인 안 된 것 · 10분 이내 것
      const now = Date.now();
      const fresh = items
        .filter(b =>
          b.id > since &&
          b.client_id !== clientId &&
          !b.acked_by &&
          now - new Date(b.created_at).getTime() < ANNOUNCE_MAX_AGE_MS
        )
        .sort((a, b) => a.id - b.id);
      if (fresh.length > 0 && soundOn) {
        if (audioCtxRef.current) playBroadcastChime(audioCtxRef.current);
        const latest = fresh[fresh.length - 1];
        // 차임이 끝난 뒤 읽기 시작
        setTimeout(() => speak(latest.message), 1200);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, loaded, soundOn]);

  // ── 내가 보낸 방송이 확인되면 작은 토스트 ──
  useEffect(() => {
    const acked = new Set(items.filter(b => b.acked_by).map(b => b.id));
    if (prevAckedRef.current === null) {
      prevAckedRef.current = acked;
      return;
    }
    const newly = items.filter(b => b.acked_by && !prevAckedRef.current!.has(b.id) && b.client_id === clientId);
    prevAckedRef.current = acked;
    if (newly.length > 0) {
      const b = newly[newly.length - 1];
      setAckToast(`${b.acked_by}님이 확인했어요 — "${b.message}"`);
      if (ackToastTimer.current) clearTimeout(ackToastTimer.current);
      ackToastTimer.current = setTimeout(() => setAckToast(null), 6000);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const doSend = async (msg: string) => {
    if (sending) return;
    setSending(true);
    const ok = await send(msg, myName.trim() || null);
    setSending(false);
    if (ok) {
      setText('');
      inputRef.current?.focus();
    }
  };

  // 배너로 띄울 방송: 남이 보낸 것, 아직 확인 안 된 것, 30분 이내, 내가 닫지 않은 것
  const now = Date.now();
  const banners = items
    .filter(b =>
      b.client_id !== clientId &&
      !b.acked_by &&
      !dismissed.has(b.id) &&
      now - new Date(b.created_at).getTime() < BANNER_MAX_AGE_MS
    )
    .sort((a, b) => b.id - a.id)
    .slice(0, 3);

  const recent = items.slice(0, 6);

  return (
    <>
      {/* ── 받은 방송 배너 (화면 위쪽, 크게) ── */}
      {banners.length > 0 && (
        <div className="fixed top-0 inset-x-0 z-[90] flex flex-col gap-1.5 p-2 pointer-events-none">
          {banners.map((b, i) => (
            <div
              key={b.id}
              className={`pointer-events-auto mx-auto w-full max-w-3xl rounded-xl shadow-2xl border-2 ${
                i === 0
                  ? 'bg-rose-600 border-rose-300 text-white animate-fadein'
                  : 'bg-rose-500/90 border-rose-300/60 text-white'
              }`}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                <span className="text-3xl shrink-0 animate-pulse" aria-hidden>📢</span>
                <div className="min-w-0 flex-1">
                  <p className={`font-extrabold leading-snug break-words ${i === 0 ? 'text-2xl md:text-3xl' : 'text-lg'}`}>
                    {b.message}
                  </p>
                  <p className="text-xs md:text-sm text-white/80 mt-0.5">
                    {b.sender || '이름 없음'} · {timeLabel(b.created_at)}
                  </p>
                </div>
                <button
                  onClick={() => speak(b.message, 1)}
                  className="shrink-0 flex items-center gap-1 h-10 px-3 rounded-lg bg-white/15 hover:bg-white/25 text-sm font-semibold transition"
                  title="다시 읽어주기"
                >
                  <IconVolume className="w-4 h-4" />
                  <span className="hidden sm:inline">다시 듣기</span>
                </button>
                <button
                  onClick={() => ack(b.id, myName.trim() || null)}
                  className="shrink-0 h-10 px-4 rounded-lg bg-white text-rose-700 hover:bg-rose-50 text-sm font-bold shadow transition"
                >
                  ✅ 확인했어요
                </button>
                <button
                  onClick={() => setDismissed(prev => new Set(prev).add(b.id))}
                  className="shrink-0 flex items-center justify-center w-8 h-8 rounded hover:bg-white/15 transition"
                  aria-label="닫기 (확인 표시 없이)"
                  title="닫기 (확인 표시 없이)"
                >
                  <IconX className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── 내 방송 확인됨 토스트 ── */}
      {ackToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[85] animate-fadein">
          <div className="flex items-center gap-2 bg-emerald-600 text-white rounded shadow-xl px-4 py-2.5 text-sm font-semibold max-w-[90vw]">
            <span>✅</span>
            <span className="truncate">{ackToast}</span>
            <button onClick={() => setAckToast(null)} className="ml-1 p-1 rounded hover:bg-white/15" aria-label="닫기">
              <IconX className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── 방송 보내기 패널 (아래 가운데) ── */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[75] flex flex-col items-center gap-2 w-[min(92vw,30rem)]">
        {open && (
          <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-fadein">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
              <span className="text-base" aria-hidden>📢</span>
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">층간 방송</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">다른 현황판 화면에서 소리로 읽어줘요</span>
              <label className="ml-auto flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                내 이름
                <input
                  value={myName}
                  onChange={e => saveName(e.target.value)}
                  placeholder="이름"
                  className="w-16 h-6 px-1.5 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100"
                />
              </label>
              <button
                onClick={toggleOpen}
                className="flex items-center justify-center w-7 h-7 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                aria-label="패널 접기"
              >
                <IconX className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>

            {tableMissing ? (
              <div className="px-3 py-3 text-xs text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/30">
                방송 테이블이 아직 없습니다. Supabase SQL Editor에서 저장소의 <b>broadcast_setup.sql</b>을 한 번 실행해 주세요.
              </div>
            ) : (
              <>
                {/* 자주 쓰는 말 — 한 번 누르면 바로 방송 */}
                <div className="flex flex-wrap gap-1.5 px-3 pt-2.5">
                  {QUICK_PHRASES.map(p => (
                    <button
                      key={p}
                      onClick={() => doSend(p)}
                      disabled={sending}
                      className="h-8 px-3 rounded-full bg-slate-100 hover:bg-rose-100 dark:bg-slate-800 dark:hover:bg-rose-900/40 text-xs font-semibold text-slate-700 dark:text-slate-200 transition disabled:opacity-50"
                    >
                      {p}
                    </button>
                  ))}
                </div>

                <form
                  onSubmit={e => { e.preventDefault(); doSend(text); }}
                  className="flex items-center gap-2 px-3 py-2.5"
                >
                  <input
                    ref={inputRef}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    maxLength={120}
                    placeholder="하고 싶은 말을 적고 엔터"
                    className="flex-1 h-10 px-3 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-rose-400"
                  />
                  <button
                    type="submit"
                    disabled={sending || !text.trim()}
                    className="h-10 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold shadow transition disabled:opacity-40"
                  >
                    방송
                  </button>
                </form>

                {error && (
                  <div className="px-3 pb-2 text-[11px] text-rose-600">오류: {error}</div>
                )}

                {/* 최근 방송 기록 */}
                {recent.length > 0 && (
                  <ul className="border-t border-slate-200 dark:border-slate-700 max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {recent.map(b => (
                      <RecentRow key={b.id} b={b} mine={b.client_id === clientId} />
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        )}

        <button
          onClick={toggleOpen}
          className={`flex items-center gap-2 h-11 px-5 rounded-full shadow-xl text-sm font-bold transition ${
            open
              ? 'bg-slate-700 hover:bg-slate-600 text-white'
              : 'bg-rose-600 hover:bg-rose-500 text-white'
          }`}
          title="층간 방송 — 다른 층 현황판에 소리로 전달"
        >
          <span aria-hidden>📢</span>
          {open ? '방송 닫기' : '방송하기'}
        </button>
      </div>
    </>
  );
}

function RecentRow({ b, mine }: { b: Broadcast; mine: boolean }) {
  return (
    <li className="flex items-center gap-2 px-3 py-1.5 text-xs">
      <span className="text-slate-400 shrink-0 tabular-nums">{timeLabel(b.created_at)}</span>
      <span className={`shrink-0 font-semibold ${mine ? 'text-rose-600' : 'text-slate-600 dark:text-slate-300'}`}>
        {mine ? '나' : (b.sender || '이름 없음')}
      </span>
      <span className="truncate text-slate-800 dark:text-slate-100 flex-1">{b.message}</span>
      {b.acked_by ? (
        <span className="shrink-0 text-emerald-600 dark:text-emerald-400 font-semibold" title={b.acked_at ? timeLabel(b.acked_at) : ''}>
          ✓ {b.acked_by}
        </span>
      ) : (
        <span className="shrink-0 text-slate-400">대기중</span>
      )}
    </li>
  );
}
