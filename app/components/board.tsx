'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { FilterType, CheckMark } from './types';
import { useAuth } from './hooks/useAuth';
import { useBoardData } from './hooks/useBoardData';
import { handlePrintTodayWork, handlePrintImage } from './utils/printUtils';

import PasswordGate from './PasswordGate';
import Header from './Header';
import InputFormModal from './InputFormModal';
import ImageModal from './ImageModal';
import CompleteConfirmModal from './CompleteConfirmModal';
import RequestCard from './RequestCard';
import CompletedCard from './CompletedCard';
import DeletedCard from './DeletedCard';
import JustUploadCard from './JustUploadCard';

interface BoardProps {
  only?: FilterType;
}

export default function Board({ only }: BoardProps) {
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
    deleted,
    justUpload
  } = useBoardData();

  // UI 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [hideOverdue, setHideOverdue] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
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

  // ⭐ 이제 모든 hooks 호출 후에 early return
  if (authChecked && !isAuthed) {
    return <PasswordGate onAuthenticated={handleAuthentication} />;
  }

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
      isJustUpload: item.is_just_upload || false,
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

  return (
    <div className="min-h-screen bg-white p-4 md:p-6 font-sans text-gray-800">
      {/* 헤더 */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onPrintTodayWork={() => handlePrintTodayWork(requests)}
        onShowForm={handleShowForm}
        showForm={showForm}
        editMode={editMode}
        justUploadCount={justUpload.length}
        hideOverdue={hideOverdue}
        onToggleHideOverdue={() => setHideOverdue(prev => !prev)}
        overdueHiddenCount={overdueHiddenCount}
      />

      {/* 모달들 */}
      <InputFormModal
        showForm={showForm}
        editMode={editMode}
        editingId={editingId}
        initialData={formInitialData}
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

      {/* 메인 컨텐츠 */}
      <div className="max-w-screen-2xl mx-auto">
        {only === 'completed' ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-base text-green-700">
                ✅ 완료
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
              )}
            </div>
          </div>
        ) : only === 'deleted' ? (
          <div>
            <h2 className="font-semibold text-base text-gray-500 mb-2">🗑 삭제됨</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {deleted.map(item => (
                <DeletedCard
                  key={item.id}
                  item={item}
                  onRefresh={fetchRequests}
                />
              ))}
            </div>
          </div>
        ) : only === 'justupload' ? (
          <div>
            <h2 className="font-semibold text-base text-yellow-700 mb-2">📤 바빠서 원고만 올림</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {justUpload.map(item => (
                <JustUploadCard
                  key={item.id}
                  item={item}
                  onRefresh={fetchRequests}
                />
              ))}
            </div>
          </div>
        ) : (
          <section className="relative z-10 space-y-10 pb-32">
            {/* 상태 필터 활성화 배너 */}
            {statusFilter !== null && (
              <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-2 text-sm text-blue-700 font-semibold">
                <span>🔍 상태 필터 적용 중: <span className="bg-blue-100 px-2 py-0.5 rounded-full">{
                  statusFilter === 'urgent' ? '⚡ 급함'
                  : statusFilter === 'today' ? '📅 오늘까지'
                  : statusFilter === 'overdue' ? '⏰ 지남'
                  : statusFilter.startsWith('d-') ? `D-${statusFilter.slice(2)}`
                  : statusFilter
                }</span></span>
                <button
                  onClick={() => setStatusFilter(null)}
                  className="ml-auto text-blue-400 hover:text-blue-700 font-bold"
                >
                  ✕ 필터 해제
                </button>
              </div>
            )}
            <div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
                  />
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
