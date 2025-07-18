'use client';
import { useState } from 'react';
import { FilterType } from './types';
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
  const [modalImage, setModalImage] = useState<{ url: string; company: string; program: string } | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completingItem, setCompletingItem] = useState<any>(null);
  const [formInitialData, setFormInitialData] = useState<any>(null);

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

  const filteredCompleted = completed.filter((item) =>
    item.company.includes(searchQuery) ||
    item.program.includes(searchQuery) ||
    item.creator?.includes(searchQuery)
  );

  const justUploadCount = justUpload.length;

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
            <h2 className="font-semibold text-base text-green-700 mb-2">✅ 완료</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {filteredCompleted.map(item => (
                <CompletedCard
                  key={item.id}
                  item={item}
                  onRecover={handleRecover}
                  onRefresh={fetchRequests}
                  onImageClick={(url) => setModalImage({ url, company: item.company, program: item.program })}
                />
              ))}
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
                    onImageClick={(url) => setModalImage({ url, company: item.company, program: item.program })}
                    onPrintImage={handlePrintImage}
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
