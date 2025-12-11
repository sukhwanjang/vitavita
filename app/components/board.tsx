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
  const [showForm, setShowForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalImage, setModalImage] = useState<{ url: string; company: string; program: string, id: number } | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completingItem, setCompletingItem] = useState<any>(null);
  const [formInitialData, setFormInitialData] = useState<any>(null);
  const [displayCount, setDisplayCount] = useState(28);  // 완료 목록 표시 개수 (28개씩)
  const [isLoadingMore, setIsLoadingMore] = useState(false);  // 로딩 중 상태
  const loadMoreRef = useRef<HTMLDivElement>(null);  // 무한 스크롤 트리거 ref

  // 인증이 완료되지 않았으면 PasswordGate 표시
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
    
    setCompletingItem(item);
    setShowCompleteModal(true);
  };

  const handleConfirmComplete = async () => {
    if (!completingItem) return;
    await originalHandleComplete(completingItem.id);
    setShowCompleteModal(false);
    setCompletingItem(null);
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

  // 검색 필터링
  const filteredInProgress = inProgress.filter((item) =>
    item.company.includes(searchQuery) ||
    item.program.includes(searchQuery) ||
    item.creator?.includes(searchQuery)
  );

  // 검색 필터링된 완료 목록 (전체)
  const allFilteredCompleted = completed.filter((item) =>
    item.company.includes(searchQuery) ||
    item.program.includes(searchQuery) ||
    item.creator?.includes(searchQuery)
  );

  // 표시할 완료 목록 (displayCount 개수만큼)
  const filteredCompleted = allFilteredCompleted.slice(0, displayCount);
  
  // 더 표시할 항목이 있는지 확인
  const hasMoreCompleted = allFilteredCompleted.length > displayCount;
  const remainingCount = allFilteredCompleted.length - displayCount;

  // 무한 스크롤: 28개씩 더 로드
  const loadMore = useCallback(() => {
    if (hasMoreCompleted && !isLoadingMore) {
      setIsLoadingMore(true);
      setTimeout(() => {
        setDisplayCount(prev => prev + 28);
        setIsLoadingMore(false);
      }, 200);
    }
  }, [hasMoreCompleted, isLoadingMore]);

  // IntersectionObserver로 무한 스크롤 구현
  useEffect(() => {
    if (only !== 'completed') return;
    
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMoreCompleted && !isLoadingMore) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [only, hasMoreCompleted, isLoadingMore, loadMore]);

  const justUploadCount = justUpload.length;

  // 현재 모달에 표시할 아이템의 체크마크 가져오기
  const currentItem = modalImage ? requests.find(r => r.id === modalImage.id) : null;
  const currentCheckMarks = currentItem?.check_marks || [];

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
        justUploadCount={justUploadCount}
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
        item={completingItem}
        onConfirm={handleConfirmComplete}
        onCancel={() => {
          setShowCompleteModal(false);
          setCompletingItem(null);
        }}
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
