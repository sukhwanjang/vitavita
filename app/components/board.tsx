'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { FilterType, CheckMark } from './types';
import { useAuth } from './hooks/useAuth';
import { useBoardData } from './hooks/useBoardData';
import { useFileDrops } from './hooks/useFileDrops';
import { handlePrintImage } from './utils/printUtils';

import PasswordGate from './PasswordGate';
import Header from './Header';
import InputFormModal from './InputFormModal';
import ImageModal from './ImageModal';
import CompleteConfirmModal from './CompleteConfirmModal';
import RequestCard from './RequestCard';
import CompletedCard from './CompletedCard';
import DeletedCard from './DeletedCard';
import FileSidebar from './FileSidebar';
import FileDropModal from './FileDropModal';
import CalculatorModal from './CalculatorModal';
import FrameCalcModal from './FrameCalcModal';
import { IconBell, IconFilter, IconX, IconCheckCircle, IconTrash } from './ui/icons';

interface BoardProps {
  only?: FilterType;
}

// 경로에서 파일명만 추출
const fileNameOf = (path: string) => path.split('\\').pop()?.split('/').pop() ?? path;

// 새 출력요청 알림음 ("띵동" 2음) — 공유 AudioContext 사용 (브라우저 자동재생 차단 대응)
const playNotifySound = (ctx: AudioContext) => {
  try {
    if (ctx.state === 'suspended') ctx.resume();
    const tone = (freq: number, start: number, dur: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      o.start(ctx.currentTime + start);
      o.stop(ctx.currentTime + start + dur);
    };
    tone(880, 0, 0.35);
    tone(1174.66, 0.18, 0.45);
  } catch {
    // 오디오가 차단된 환경은 조용히 무시
  }
};

export default function Board({ only }: BoardProps) {
  const router = useRouter();
  const { authChecked, isAuthed, handleAuthentication } = useAuth();
  const {
    requests,
    fetchRequests,
    handleComplete: originalHandleComplete,
    handleRecover,
    handleDelete,
    updateCheckMarks,
    handleWorkDone,
    inProgress,
    completed,
    deleted
  } = useBoardData();
  const { drops, doneDrops, error: fileDropError, addDrop, removeDrop, restoreDrop, removeByRequest } = useFileDrops();

  // UI 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [hideOverdue, setHideOverdue] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showFileDrop, setShowFileDrop] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [showFrameCalc, setShowFrameCalc] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalImage, setModalImage] = useState<{ url: string; company: string; program: string, id: number } | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completingItem, setCompletingItem] = useState<any>(null);
  const [pendingQueue, setPendingQueue] = useState<any[]>([]);   // 남은 연속 완료 대상
  const [queueTotal, setQueueTotal] = useState(1);               // 체인 총 개수
  const [formInitialData, setFormInitialData] = useState<any>(null);
  const [displayCount, setDisplayCount] = useState(28);  // 완료 목록 표시 개수 (28개씩)
  const [isLoadingMore, setIsLoadingMore] = useState(false);  // 로딩 중 상태
  const loadMoreRef = useRef<HTMLDivElement>(null);  // 무한 스크롤 트리거 ref
  const [lastSeenId, setLastSeenId] = useState<number | null>(null);  // 새 작업 알림 기준 (이 id 이후 등록분이 "새 작업")
  const [sidebarOpen, setSidebarOpen] = useState(true);  // 출력대기 열림/닫힘

  // 출력대기 열림 상태 복원
  useEffect(() => {
    const stored = localStorage.getItem('vitavita_sidebar_open');
    if (stored !== null) setSidebarOpen(stored === '1');
  }, []);

  const toggleSidebar = () => {
    setSidebarOpen(prev => {
      localStorage.setItem('vitavita_sidebar_open', prev ? '0' : '1');
      return !prev;
    });
  };

  // 새 파일 도착 시 출력대기 자동 펼침
  const openSidebar = () => {
    localStorage.setItem('vitavita_sidebar_open', '1');
    setSidebarOpen(true);
  };

  // ── 출력대기 새 파일 알림 (모든 페이지에서 동작) ──
  const [lastSeenDropId, setLastSeenDropId] = useState<number | null>(null);
  const [soundOn, setSoundOn] = useState(true);

  // 공유 AudioContext — 브라우저는 "클릭 한 번" 전까지 소리를 막으므로,
  // 첫 클릭/키입력 때 오디오를 활성화해두고 이후 알림음은 언제든 재생
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [audioReady, setAudioReady] = useState(true); // 판정 전에는 배너 숨김
  useEffect(() => {
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = new Ctx();
    audioCtxRef.current = ctx;
    setAudioReady(ctx.state === 'running');
    ctx.onstatechange = () => setAudioReady(ctx.state === 'running');
    const unlock = () => {
      ctx.resume().catch(() => {});
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      ctx.close().catch(() => {});
    };
  }, []);
  const [dropToast, setDropToast] = useState<{ name: string; creator: string | null } | null>(null);
  const prevMaxDropIdRef = useRef<number | null>(null);
  const dropToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 마지막 확인 id / 알림음 설정 복원
  useEffect(() => {
    const stored = localStorage.getItem('vitavita_last_seen_drop_id');
    setLastSeenDropId(stored !== null ? Number(stored) : -1);
    setSoundOn(localStorage.getItem('vitavita_sound') !== '0');
  }, []);

  // 첫 방문이면 현재 파일까지 확인한 것으로 조용히 초기화
  useEffect(() => {
    if (lastSeenDropId === -1 && drops.length > 0) {
      const maxId = Math.max(...drops.map(d => d.id));
      localStorage.setItem('vitavita_last_seen_drop_id', String(maxId));
      setLastSeenDropId(maxId);
    }
  }, [lastSeenDropId, drops]);

  const markDropsSeen = () => {
    if (drops.length === 0) return;
    const maxId = Math.max(...drops.map(d => d.id));
    localStorage.setItem('vitavita_last_seen_drop_id', String(maxId));
    setLastSeenDropId(maxId);
  };

  const toggleSound = () => {
    setSoundOn(prev => {
      localStorage.setItem('vitavita_sound', prev ? '0' : '1');
      return !prev;
    });
  };

  // 새 출력요청 도착 → 토스트 + 알림음 + 패널 자동 펼침 (누가 올렸든 무조건)
  useEffect(() => {
    const maxId = drops.length > 0 ? Math.max(...drops.map(d => d.id)) : 0;
    if (prevMaxDropIdRef.current === null) {
      prevMaxDropIdRef.current = maxId;
      return;
    }
    if (maxId > prevMaxDropIdRef.current) {
      prevMaxDropIdRef.current = maxId;
      const newest = drops.find(d => d.id === maxId);
      if (newest) {
        setDropToast({ name: fileNameOf(newest.path), creator: newest.creator });
        if (dropToastTimerRef.current) clearTimeout(dropToastTimerRef.current);
        dropToastTimerRef.current = setTimeout(() => setDropToast(null), 7000);
        if (soundOn && audioCtxRef.current) playNotifySound(audioCtxRef.current);
        openSidebar();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drops, soundOn]);

  // 토스트 "보기": 메인으로 이동 + 패널 펼침
  const goToDrops = () => {
    setDropToast(null);
    openSidebar();
    if (only) router.push('/');
  };

  // 검색 필터링된 완료 목록 (전체) - useCallback보다 먼저 계산
  const allFilteredCompleted = completed.filter((item) =>
    item.company.includes(searchQuery) ||
    item.program.includes(searchQuery) ||
    item.creator?.includes(searchQuery)
  );

  // ⭐ useCallback을 early return 전에 배치
  const loadMore = useCallback(() => {
    setDisplayCount(prev => {
      const currentTotal = allFilteredCompleted.length;
      const currentDisplay = prev;

      // 더 로드할 항목이 있고, 현재 로딩 중이 아닐 때만
      if (currentTotal > currentDisplay) {
        setIsLoadingMore(true);
        setTimeout(() => {
          setIsLoadingMore(false);
        }, 200);
        return currentDisplay + 28;
      }
      return currentDisplay;
    });
  }, [allFilteredCompleted.length]);

  // ⭐ useEffect를 early return 전에 배치
  useEffect(() => {
    if (only !== 'completed' || !loadMoreRef.current) return;

    const currentRef = loadMoreRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(currentRef);

    return () => {
      observer.disconnect();
    };
  }, [only, loadMore]);

  // 새 작업 알림: 저장된 마지막 확인 id 불러오기 (-1 = 첫 방문)
  useEffect(() => {
    const stored = localStorage.getItem('vitavita_last_seen_id');
    setLastSeenId(stored !== null ? Number(stored) : -1);
  }, []);

  // 첫 방문이면 현재 최신 글까지 확인한 것으로 조용히 초기화 (전부 NEW로 뜨는 것 방지)
  useEffect(() => {
    if (lastSeenId === -1 && requests.length > 0) {
      const maxId = Math.max(...requests.map(r => r.id));
      localStorage.setItem('vitavita_last_seen_id', String(maxId));
      setLastSeenId(maxId);
    }
  }, [lastSeenId, requests]);

  // 새 작업 + 새 출력요청 수를 브라우저 탭 제목에 표시
  useEffect(() => {
    const myName = localStorage.getItem('vitavita_creator');
    const workCount = lastSeenId !== null && lastSeenId >= 0
      ? requests.filter(r => !r.completed && !r.is_deleted && r.id > lastSeenId && r.creator !== myName).length
      : 0;
    const dropCount = lastSeenDropId !== null && lastSeenDropId >= 0
      ? drops.filter(d => d.id > lastSeenDropId).length
      : 0;
    const total = workCount + dropCount;
    document.title = total > 0 ? `(${total}) 비타민사인 현황판` : '비타민사인 현황판';
  }, [requests, lastSeenId, drops, lastSeenDropId]);

  // 새 작업 NEW 뱃지: 배너 없이 60초 후 자동 확인 처리
  useEffect(() => {
    const myName = localStorage.getItem('vitavita_creator');
    const count = lastSeenId !== null && lastSeenId >= 0
      ? requests.filter(r => !r.completed && !r.is_deleted && r.id > lastSeenId && r.creator !== myName).length
      : 0;
    if (count === 0) return;
    const t = setTimeout(() => {
      const maxId = Math.max(...requests.map(r => r.id));
      localStorage.setItem('vitavita_last_seen_id', String(maxId));
      setLastSeenId(maxId);
    }, 60000);
    return () => clearTimeout(t);
  }, [requests, lastSeenId]);

  // ⭐ 이제 모든 hooks 호출 후에 early return
  if (authChecked && !isAuthed) {
    return <PasswordGate onAuthenticated={handleAuthentication} />;
  }

  // 내가 등록한 글은 나에게 새 작업으로 알리지 않는다
  const myCreatorName = typeof window !== 'undefined' ? localStorage.getItem('vitavita_creator') : null;
  const newItems = lastSeenId !== null && lastSeenId >= 0
    ? requests.filter(r => !r.completed && !r.is_deleted && r.id > lastSeenId && r.creator !== myCreatorName)
    : [];
  const newIds = new Set(newItems.map(r => r.id));

  // 새 출력요청 id 목록 (내가 올린 것도 포함 — 무조건 표시)
  const newDropIds = new Set(
    lastSeenDropId !== null && lastSeenDropId >= 0
      ? drops.filter(d => d.id > lastSeenDropId).map(d => d.id)
      : []
  );

  // 편집 핸들러
  const handleEdit = (item: any) => {
    setFormInitialData({
      company: item.company,
      program: item.program,
      pickupDate: item.pickup_date,
      note: item.note,
      imageUrl: item.image_url,
      isUrgent: item.is_urgent,
      creator: item.creator,
    });
    setEditingId(item.id);
    setEditMode(true);
    setShowForm(true);
  };

  // 완료 처리 핸들러
  const handleComplete = (id: number) => {
    const item = requests.find(r => r.id === id);
    if (!item) return;

    // 같은 업체+프로그램이면서 아직 완료/삭제되지 않은 다른 글 탐색
    const matched = requests.filter(r =>
      r.id !== id &&
      r.company === item.company &&
      r.program === item.program &&
      !r.completed &&
      !r.is_deleted
    );

    setCompletingItem(item);
    setPendingQueue(matched);
    setQueueTotal(1 + matched.length);
    setShowCompleteModal(true);
  };

  // 다음 큐 항목으로 이동하는 공통 함수
  const advanceQueue = () => {
    if (pendingQueue.length > 0) {
      setCompletingItem(pendingQueue[0]);
      setPendingQueue(prev => prev.slice(1));
    } else {
      setShowCompleteModal(false);
      setCompletingItem(null);
      setPendingQueue([]);
      setQueueTotal(1);
    }
  };

  const handleConfirmComplete = async () => {
    if (!completingItem) return;
    await originalHandleComplete(completingItem.id);
    // 카드 완료 → 연결된 출력요청 자동 정리 (출력대기에 잔재가 안 남게)
    removeByRequest(completingItem.id);
    advanceQueue();
  };

  const handleSkipComplete = () => {
    advanceQueue();
  };

  const handleCancelComplete = () => {
    setShowCompleteModal(false);
    setCompletingItem(null);
    setPendingQueue([]);
    setQueueTotal(1);
  };

  // 폼 관련 핸들러
  const handleShowForm = () => {
    setShowForm(!showForm);
    if (showForm) {
      // 폼 닫기
      setEditMode(false);
      setEditingId(null);
      setFormInitialData(null);
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditMode(false);
    setEditingId(null);
    setFormInitialData(null);
  };

  const handleFormSuccess = () => {
    handleFormClose();
    fetchRequests();
  };

  // 검색 필터링 (이미 위에서 allFilteredCompleted 계산했으므로 중복 제거)
  const filteredInProgress = inProgress.filter((item) => {
    const matchesSearch =
      item.company.includes(searchQuery) ||
      item.program.includes(searchQuery) ||
      item.creator?.includes(searchQuery);
    if (!matchesSearch) return false;

    // 날짜 계산 (hideOverdue & statusFilter 공통)
    const daysLeft = item.pickup_date
      ? Math.ceil(
          (new Date(item.pickup_date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0))
          / (1000 * 60 * 60 * 24)
        )
      : null;

    // 지남 숨김 조건
    if (hideOverdue && daysLeft !== null && daysLeft < 0) return false;

    // 상태 뱃지 필터 조건
    if (statusFilter !== null) {
      const itemKey = item.is_urgent
        ? 'urgent'
        : daysLeft === 0
          ? 'today'
          : daysLeft !== null && daysLeft > 0
            ? `d-${daysLeft}`
            : 'overdue';
      if (itemKey !== statusFilter) return false;
    }

    return true;
  });

  // 숨겨진 지남 항목 수
  const overdueHiddenCount = hideOverdue
    ? inProgress.filter((item) => {
        if (!item.pickup_date) return false;
        const daysLeft = Math.ceil(
          (new Date(item.pickup_date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0))
          / (1000 * 60 * 60 * 24)
        );
        return daysLeft < 0;
      }).length
    : 0;

  // 현황 요약 통계 (진행 중 목록 기준)
  const daysLeftOf = (item: any) =>
    item.pickup_date
      ? Math.ceil(
          (new Date(item.pickup_date).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0))
          / (1000 * 60 * 60 * 24)
        )
      : null;
  const urgentCount = inProgress.filter(i => i.is_urgent).length;
  const todayCount = inProgress.filter(i => !i.is_urgent && daysLeftOf(i) === 0).length;
  const todayDoneCount = inProgress.filter(i => !i.is_urgent && daysLeftOf(i) === 0 && i.is_work_done).length;
  const tomorrowCount = inProgress.filter(i => !i.is_urgent && daysLeftOf(i) === 1).length;
  const overdueCount = inProgress.filter(i => {
    const d = daysLeftOf(i);
    return !i.is_urgent && d !== null && d < 0;
  }).length;

  // 표시할 완료 목록 (displayCount 개수만큼)
  const filteredCompleted = allFilteredCompleted.slice(0, displayCount);

  // 더 표시할 항목이 있는지 확인
  const hasMoreCompleted = allFilteredCompleted.length > displayCount;
  const remainingCount = allFilteredCompleted.length - displayCount;

  // 현재 모달에 표시할 아이템의 체크마크 가져오기
  const currentItem = modalImage ? requests.find(r => r.id === modalImage.id) : null;
  const currentCheckMarks = currentItem?.check_marks || [];

  // 완료 모달에 실시간 체크마크 반영 (updateCheckMarks 후 requests가 갱신되므로 여기서 조회)
  const completingItemLive = completingItem
    ? (requests.find(r => r.id === completingItem.id) ?? completingItem)
    : null;

  // 등록 폼 자동완성용 — 최근 등록 순 정렬
  const recentSorted = [...requests].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  // 업체명: 중복 제거 목록
  const companySuggestions = Array.from(new Set(
    recentSorted.map(r => r.company).filter(Boolean)
  ));
  // 프로그램명: 업체별 매칭을 위해 (업체, 프로그램) 쌍으로 전달
  const programSuggestions = Array.from(new Map(
    recentSorted
      .filter(r => r.program)
      .map(r => [`${r.company}|${r.program}`, { company: r.company, program: r.program }] as const)
  ).values());

  return (
    <div className="min-h-screen bg-[#f4f6f9] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* 헤더 (출력 전용 화면에서는 숨김) */}
      {only !== 'queue' && (
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onShowForm={handleShowForm}
        onShowFileDrop={() => setShowFileDrop(true)}
        onShowCalculator={() => setShowCalculator(true)}
        onShowFrameCalc={() => setShowFrameCalc(true)}
        showForm={showForm}
        editMode={editMode}
        hideOverdue={hideOverdue}
        onToggleHideOverdue={() => setHideOverdue(prev => !prev)}
        overdueHiddenCount={overdueHiddenCount}
      />
      )}

      {/* 알림음 잠김 안내 (브라우저가 소리를 막은 상태 — 클릭 한 번이면 활성화) */}
      {soundOn && !audioReady && (
        <button
          onClick={() => audioCtxRef.current?.resume().catch(() => {})}
          className="fixed bottom-4 right-4 z-[80] flex items-center gap-2 rounded-lg bg-amber-400 hover:bg-amber-300 text-amber-950 text-sm font-bold px-4 py-3 shadow-xl animate-pulse transition"
          title="브라우저 보안 정책 때문에 첫 클릭 전까지 소리가 차단됩니다"
        >
          🔕 알림음이 잠겨 있어요 — 클릭해서 켜기
        </button>
      )}

      {/* 새 출력요청 토스트 (어느 페이지에 있어도 표시) */}
      {dropToast && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[80] animate-fadein">
          <div className="flex items-center gap-3 bg-blue-600 text-white rounded shadow-xl pl-4 pr-2.5 py-3 min-w-[340px] max-w-[90vw]">
            <span className="flex items-center justify-center w-9 h-9 rounded-full bg-white/15 shrink-0">
              <IconBell className="w-4 h-4 animate-pulse" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold">출력요청 도착</p>
              <p className="text-xs text-white/80 truncate">
                {dropToast.name}
                {dropToast.creator ? ` — ${dropToast.creator}` : ''}
              </p>
            </div>
            <button
              onClick={goToDrops}
              className="ml-auto shrink-0 h-8 px-3.5 rounded bg-white/20 hover:bg-white/30 text-xs font-semibold transition"
            >
              보기
            </button>
            <button
              onClick={() => setDropToast(null)}
              className="shrink-0 flex items-center justify-center w-7 h-7 rounded hover:bg-white/15 transition"
              aria-label="알림 닫기"
            >
              <IconX className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 모달들 */}
      <CalculatorModal
        show={showCalculator}
        onClose={() => setShowCalculator(false)}
        companySuggestions={companySuggestions}
        programSuggestions={programSuggestions}
      />

      <FrameCalcModal
        show={showFrameCalc}
        onClose={() => setShowFrameCalc(false)}
      />

      <FileDropModal
        show={showFileDrop}
        onClose={() => setShowFileDrop(false)}
        onAdd={(path, creator, urgent, note, requestId) => addDrop(path, creator, { urgent, note, requestId })}
        cards={inProgress}
      />

      <InputFormModal
        showForm={showForm}
        editMode={editMode}
        editingId={editingId}
        initialData={formInitialData}
        companySuggestions={companySuggestions}
        programSuggestions={programSuggestions}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
      />

      <ImageModal
        imageUrl={modalImage?.url || null}
        company={modalImage?.company}
        program={modalImage?.program}
        checkMarks={currentCheckMarks}  // DB에서 가져온 데이터 사용
        onCheckMarksChange={(newMarks) => {
          if (modalImage) {
            updateCheckMarks(modalImage.id, newMarks);  // Supabase에 저장
          }
        }}
        onClose={() => setModalImage(null)}
      />

      <CompleteConfirmModal
        item={completingItemLive}
        onConfirm={handleConfirmComplete}
        onCancel={handleCancelComplete}
        onSkip={handleSkipComplete}
        onImageClick={
          completingItemLive?.image_url
            ? () => setModalImage({
                url: completingItemLive.image_url!,
                company: completingItemLive.company,
                program: completingItemLive.program,
                id: completingItemLive.id,
              })
            : undefined
        }
        queueCurrent={queueTotal - pendingQueue.length}
        queueTotal={queueTotal}
      />

      {/* 출력 전용 화면 (/queue) — 출력대기만 꽉 차게 */}
      {only === 'queue' ? (
        <FileSidebar
          fullPage
          drops={drops}
          doneDrops={doneDrops}
          error={fileDropError}
          onRemove={removeDrop}
          onRestore={restoreDrop}
          requests={requests}
          onImageClick={(it) => {
            if (it.image_url) setModalImage({ url: it.image_url, company: it.company, program: it.program, id: it.id });
          }}
          open
          onToggle={() => {}}
          newIds={newDropIds}
          onMarkAllSeen={markDropsSeen}
          soundOn={soundOn}
          onToggleSound={toggleSound}
        />
      ) : (
      <>
      {/* 메인 컨텐츠 (메인 보드에서는 좌측 고정 출력대기 폭만큼 밀어줌) */}
      <div className={!only ? (sidebarOpen ? 'lg:pl-72' : 'lg:pl-12') : ''}>
      <div className="max-w-screen-2xl mx-auto px-4 md:px-6 py-6">
        {only === 'completed' ? (
          <div>
            <div className="flex items-center gap-2 mb-5">
              <IconCheckCircle className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">완료된 작업</h2>
              <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold">
                {allFilteredCompleted.length}건
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {filteredCompleted.map(item => (
                <CompletedCard
                  key={item.id}
                  item={item}
                  onRecover={handleRecover}
                  onRefresh={fetchRequests}
                  onImageClick={(url) => setModalImage({ url, company: item.company, program: item.program, id: item.id })}
                  onCompanyClick={(company) => setSearchQuery(company)}
                />
              ))}
            </div>

            {/* 무한 스크롤 트리거 */}
            <div ref={loadMoreRef} className="flex justify-center mt-8 py-4">
              {isLoadingMore && (
                <div className="w-8 h-8 border-4 border-slate-200 border-t-blue-600 rounded-full animate-spin"></div>
              )}
            </div>
          </div>
        ) : only === 'deleted' ? (
          <div>
            <div className="flex items-center gap-2 mb-5">
              <IconTrash className="w-5 h-5 text-slate-400" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">삭제된 작업</h2>
              <span className="inline-flex items-center h-6 px-2.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold">
                {deleted.length}건
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {deleted.map(item => (
                <DeletedCard
                  key={item.id}
                  item={item}
                  onRefresh={fetchRequests}
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* 출력대기 사이드바 (데스크톱: 좌측 고정, 모바일: 인라인) */}
            <FileSidebar
              drops={drops}
              doneDrops={doneDrops}
              error={fileDropError}
              onRemove={removeDrop}
              onRestore={restoreDrop}
              requests={requests}
              onImageClick={(it) => {
                if (it.image_url) setModalImage({ url: it.image_url, company: it.company, program: it.program, id: it.id });
              }}
              open={sidebarOpen}
              onToggle={toggleSidebar}
              newIds={newDropIds}
              onMarkAllSeen={markDropsSeen}
              soundOn={soundOn}
              onToggleSound={toggleSound}
            />
          <section className="relative z-10 space-y-5 pb-32 flex-1 min-w-0">
            {/* 현황 요약 패널 — 색은 숫자에만, 0건은 음소거 */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded shadow-sm grid grid-cols-1 md:grid-cols-5">
              {[
                { key: null as string | null, label: '전체 진행', count: inProgress.length, color: 'text-slate-900 dark:text-slate-100', progress: null as { done: number; total: number } | null },
                { key: 'urgent', label: '급함', count: urgentCount, color: 'text-red-600 dark:text-red-400', progress: null },
                { key: 'today', label: '오늘 마감', count: todayCount, color: 'text-blue-600 dark:text-blue-400', progress: { done: todayDoneCount, total: todayCount } },
                { key: 'd-1', label: '내일 마감', count: tomorrowCount, color: 'text-amber-600 dark:text-amber-400', progress: null },
                { key: 'overdue', label: '기한 지남', count: overdueCount, color: 'text-slate-800 dark:text-slate-200', progress: null },
              ].map(seg => {
                const active = seg.key !== null && statusFilter === seg.key;
                return (
                  <button
                    key={seg.label}
                    onClick={() => {
                      if (seg.key === null) setStatusFilter(null);
                      else setStatusFilter(prev => prev === seg.key ? null : seg.key);
                    }}
                    className={`relative flex items-center gap-2 text-left px-4 py-1.5 transition border-slate-100 dark:border-slate-800 border-t first:border-t-0 md:border-t-0 md:border-l md:first:border-l-0 ${
                      active ? 'bg-blue-50/60 dark:bg-blue-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 shrink-0">{seg.label}</span>
                    <span className={`text-lg leading-6 font-bold tabular-nums ${seg.count === 0 ? 'text-slate-300 dark:text-slate-700' : seg.color}`}>
                      {seg.count}
                      <span className="ml-0.5 text-[11px] font-medium text-slate-300 dark:text-slate-600">건</span>
                    </span>
                    {seg.progress && seg.progress.total > 0 && (
                      <span className="text-[10px] text-slate-400 tabular-nums shrink-0 ml-auto">✓ {seg.progress.done}/{seg.progress.total}</span>
                    )}
                    {active && <span className="absolute left-0 right-0 bottom-0 h-0.5 bg-blue-600" />}
                  </button>
                );
              })}
            </div>

            {/* 상태 필터 활성화 배너 */}
            {statusFilter !== null && (
              <div className="flex items-center gap-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300">
                <IconFilter className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span>상태 필터 적용 중:</span>
                <span className="inline-flex items-center h-6 px-2.5 rounded bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 text-xs font-semibold border border-blue-200 dark:border-blue-800">{
                  statusFilter === 'urgent' ? '급함'
                  : statusFilter === 'today' ? '오늘 마감'
                  : statusFilter === 'd-1' ? '내일 마감'
                  : statusFilter === 'overdue' ? '기한 지남'
                  : statusFilter.startsWith('d-') ? `D-${statusFilter.slice(2)}`
                  : statusFilter
                }</span>
                <button
                  onClick={() => setStatusFilter(null)}
                  className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition"
                >
                  <IconX className="w-3.5 h-3.5" />
                  필터 해제
                </button>
              </div>
            )}
            <div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {filteredInProgress.map(item => (
                  <RequestCard
                    key={item.id}
                    item={item}
                    onEdit={handleEdit}
                    onComplete={handleComplete}
                    onDelete={handleDelete}
                    onImageClick={(url) => setModalImage({ url, company: item.company, program: item.program, id: item.id })}
                    onPrintImage={handlePrintImage}
                    onWorkDone={handleWorkDone}
                    onCompanyClick={(company) => setSearchQuery(company)}
                    onStatusClick={(key) => setStatusFilter(prev => prev === key ? null : key)}
                    activeStatusFilter={statusFilter}
                    isNew={newIds.has(item.id)}
                  />
                ))}
              </div>
            </div>
          </section>
          </div>
        )}
      </div>
      </div>
      </>
      )}
    </div>
  );
}
