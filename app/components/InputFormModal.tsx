'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { IconX, IconImage, IconZap } from './ui/icons';

interface InputFormModalProps {
  showForm: boolean;
  editMode: boolean;
  editingId: number | null;
  initialData?: {
    company: string;
    program: string;
    pickupDate: string;
    note: string;
    imageUrl: string | null;
    isUrgent: boolean;
    creator: string;
  };
  onClose: () => void;
  onSuccess: () => void;
}

export default function InputFormModal({
  showForm,
  editMode,
  editingId,
  initialData,
  onClose,
  onSuccess
}: InputFormModalProps) {
  const [company, setCompany] = useState('');
  const [program, setProgram] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [note, setNote] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUrgent, setIsUrgent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [creator, setCreator] = useState<string>(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('vitavita_creator') ?? '') : ''
  );

  // 초기 데이터 설정
  useEffect(() => {
    if (initialData) {
      setCompany(initialData.company);
      setProgram(initialData.program);
      setPickupDate(initialData.pickupDate);
      setNote(initialData.note);
      setImagePreview(initialData.imageUrl);
      setIsUrgent(initialData.isUrgent);
      setCreator(initialData.creator);
    }
  }, [initialData]);

  const handlePasteImage = useCallback((e: React.ClipboardEvent) => {
    const file = e.clipboardData.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  }, []);

  useEffect(() => {
    if (showForm) {
      window.addEventListener('paste', handlePasteImage as any);
      return () => window.removeEventListener('paste', handlePasteImage as any);
    }
  }, [showForm, handlePasteImage]);

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const { error } = await supabase.storage.from('request-images').upload(fileName, file);
    if (error) {
      setError(`이미지 업로드 실패: ${error.message}`);
      return null;
    }
    const { data } = supabase.storage.from('request-images').getPublicUrl(fileName);
    return data?.publicUrl ?? null;
  };

  const handleSubmit = async () => {
    if (!company || !program || !pickupDate) {
      setError('업체명, 프로그램명, 픽업일은 필수입니다.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    let imageUrl = imagePreview;

    if (image) {
      const uploaded = await uploadImage(image);
      if (!uploaded) {
        setIsSubmitting(false);
        return;
      }
      imageUrl = uploaded;
    }

    if (editMode && editingId !== null) {
      const { error } = await supabase.from('request').update({
        company,
        program,
        pickup_date: pickupDate,
        note,
        image_url: imageUrl,
        is_urgent: isUrgent,
        creator,
      }).eq('id', editingId);

      if (error) {
        setError(`수정 실패: ${error.message}`);
        setIsSubmitting(false);
        return;
      }
    } else {
      const { error } = await supabase.from('request').insert([{
        company,
        program,
        pickup_date: pickupDate,
        note,
        image_url: imageUrl,
        is_urgent: isUrgent,
        completed: false,
        is_deleted: false,
        creator,
      }]);
      if (error) {
        alert('등록 실패: ' + error.message);
        setIsSubmitting(false);
        return;
      }
    }

    setIsSubmitting(false);
    clearForm();
    onSuccess();
  };

  const clearForm = () => {
    setCompany('');
    setProgram('');
    setPickupDate('');
    setNote('');
    setImage(null);
    setImagePreview(null);
    setIsUrgent(false);
    // 작업자명은 localStorage에 저장된 값 유지
    setCreator(localStorage.getItem('vitavita_creator') ?? '');
    onClose();
  };

  const setTodayDate = () => {
    const now = new Date();
    const korea = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    setPickupDate(korea.toISOString().slice(0, 10));
  };

  if (!showForm) return null;

  const inputClass = "rounded border border-slate-300 px-3.5 h-10 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[2px] p-4" onPaste={handlePasteImage}>
      <div className="bg-white rounded-md shadow-xl border border-slate-200 w-full max-w-xl relative animate-fadein max-h-[90vh] overflow-y-auto">
        {/* 모달 헤더 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-md z-10">
          <div>
            <h3 className="text-base font-bold text-slate-900">{editMode ? '작업 수정' : '새 작업 등록'}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{editMode ? '작업 내용을 수정합니다.' : '새 작업을 현황판에 등록합니다.'}</p>
          </div>
          <button
            className="flex items-center justify-center w-8 h-8 rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            onClick={clearForm}
            aria-label="닫기"
          >
            <IconX className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col">
              <label className="text-[13px] font-medium text-slate-600 mb-1.5">업체명 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={company}
                onChange={e => setCompany(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[13px] font-medium text-slate-600 mb-1.5">프로그램명 <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={program}
                onChange={e => setProgram(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[13px] font-medium text-slate-600 mb-1.5">픽업일 <span className="text-red-500">*</span></label>
              <div className="flex gap-1.5">
                <input
                  type="date"
                  value={pickupDate}
                  onChange={e => setPickupDate(e.target.value)}
                  className={`${inputClass} flex-1 min-w-0`}
                />
                <button
                  type="button"
                  className="shrink-0 h-10 px-3 rounded border border-slate-300 bg-white text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                  onClick={setTodayDate}
                >
                  오늘
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col mt-5">
            <label className="text-[13px] font-medium text-slate-600 mb-1.5">작업자 선택</label>
            <div className="grid grid-cols-3 gap-2">
              {['박혜경', '김한별', '장석환', '정수원', '이현동', '심민영'].map((name) => (
                <button
                  key={name}
                  onClick={() => {
                    setCreator(name);
                    localStorage.setItem('vitavita_creator', name);
                  }}
                  className={`h-9 rounded text-sm font-medium border transition ${
                    creator === name
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-700'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
            {error && <p className="text-red-600 text-[13px] mt-2">{error}</p>}
          </div>

          <div className="flex flex-col mt-5">
            <label className="text-[13px] font-medium text-slate-600 mb-1.5">메모</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              className="rounded border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition"
              rows={3}
            />
          </div>

          {/* 원고이미지 업로드 영역 - 붙여넣기만 지원 */}
          <div className="flex flex-col mt-5">
            <label className="text-[13px] font-medium text-slate-600 mb-1.5">원고 이미지</label>
            <div className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded p-5 bg-slate-50/60 transition hover:border-blue-400 min-h-[120px]">
              {imagePreview ? (
                <div className="relative w-full flex flex-col items-center">
                  <img src={imagePreview} className="max-h-52 object-contain border border-slate-200 rounded mb-2 bg-white" />
                  <button
                    onClick={() => { setImage(null); setImagePreview(null); }}
                    className="text-xs font-medium text-red-500 hover:text-red-700 transition"
                  >
                    이미지 제거
                  </button>
                </div>
              ) : (
                <div className="text-slate-400 text-sm text-center flex flex-col items-center gap-1.5">
                  <IconImage className="w-7 h-7 text-slate-300" />
                  <span>여기에 이미지를 <b className="text-slate-500">Ctrl+V</b>로 붙여넣으세요</span>
                  <span className="text-xs text-slate-300">(파일 선택 없이 캡처만 지원)</span>
                </div>
              )}
            </div>
          </div>

          {/* 급함 토글 */}
          <div className="flex items-center mt-5 gap-3">
            {/* 급함 토글 스위치 */}
            <button
              type="button"
              onClick={() => setIsUrgent(!isUrgent)}
              className={`inline-flex items-center gap-2 h-9 px-3.5 rounded border text-sm font-medium transition ${
                isUrgent
                  ? 'bg-orange-50 text-orange-700 border-orange-300'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
              }`}
            >
              <IconZap className={`w-4 h-4 ${isUrgent ? 'text-orange-500' : 'text-slate-300'}`} />
              급함
              <span
                className={`relative inline-flex items-center w-8 h-[18px] rounded-full transition-colors ${isUrgent ? 'bg-orange-500' : 'bg-slate-200'}`}
              >
                <span
                  className={`inline-block w-3.5 h-3.5 transform bg-white rounded-full shadow transition-transform ${isUrgent ? 'translate-x-[15px]' : 'translate-x-[2px]'}`}
                />
              </span>
            </button>
          </div>
        </div>

        {/* 모달 푸터 */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50/60 rounded-b-md">
          <button
            onClick={clearForm}
            className="h-10 px-5 rounded border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            className="h-10 px-6 rounded bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800 transition disabled:bg-slate-300"
            disabled={isSubmitting}
          >
            {isSubmitting ? '처리 중...' : editMode ? '수정' : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
}
