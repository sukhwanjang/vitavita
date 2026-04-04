'use client';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';

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
    isJustUpload: boolean;
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
  const [isJustUpload, setIsJustUpload] = useState(false);

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
      setIsJustUpload(initialData.isJustUpload);
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
        is_just_upload: isJustUpload,
        creator,
      }).eq('id', editingId);

      if (error) setError(`수정 실패: ${error.message}`);
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
        is_just_upload: isJustUpload,
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
    setIsJustUpload(false);
    onClose();
  };

  const setTodayDate = () => {
    const now = new Date();
    const korea = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    setPickupDate(korea.toISOString().slice(0, 10));
  };

  if (!showForm) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onPaste={handlePasteImage}>
      <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 w-full max-w-xl relative animate-fadein max-h-[90vh] overflow-y-auto">
        <button
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-3xl font-bold transition"
          onClick={clearForm}
          aria-label="닫기"
        >
          ×
        </button>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex flex-col">
            <label className="font-semibold text-gray-800 mb-1">업체명 *</label>
            <input 
              type="text" 
              value={company} 
              onChange={e => setCompany(e.target.value)} 
              className="rounded-xl border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-400 transition text-base" 
            />
          </div>
          <div className="flex flex-col">
            <label className="font-semibold text-gray-800 mb-1">프로그램명 *</label>
            <input 
              type="text" 
              value={program} 
              onChange={e => setProgram(e.target.value)} 
              className="rounded-xl border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-400 transition text-base" 
            />
          </div>
          <div className="flex flex-col">
            <label className="font-semibold text-gray-800 mb-1">픽업일 *</label>
            <input 
              type="date" 
              value={pickupDate} 
              onChange={e => setPickupDate(e.target.value)} 
              className="rounded-xl border border-gray-300 px-4 py-2 text-gray-800 focus:ring-2 focus:ring-blue-400 transition text-base h-11" 
            />
            <button
              type="button"
              className="mt-2 px-3 py-1 rounded-full bg-blue-500 text-white text-xs font-semibold shadow hover:bg-blue-600 transition self-start"
              onClick={setTodayDate}
            >
              오늘
            </button>
          </div>
        </div>

        <div className="flex flex-col mt-6">
          <label className="font-semibold text-gray-800 mb-2">작업자 선택</label>
          <div className="grid grid-cols-2 gap-3">
            {['박혜경', '김한별', '장석환', '정수원', '이현동'].map((name) => (
              <button
                key={name}
                onClick={() => {
                  setCreator(name);
                  localStorage.setItem('vitavita_creator', name);
                }}
                className={`rounded-full px-4 py-2 font-bold border-2 transition text-base shadow-sm
                  ${creator === name
                    ? 'bg-blue-500 text-white border-blue-600 scale-105'
                    : 'bg-white text-gray-800 border-gray-300 hover:bg-blue-50'}
                `}
              >
                {name}
              </button>
            ))}
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </div>

        <div className="flex flex-col mt-6">
          <label className="font-semibold text-gray-800 mb-1">메모</label>
          <textarea 
            value={note} 
            onChange={e => setNote(e.target.value)} 
            className="rounded-xl border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-400 transition text-base" 
            rows={3} 
          />
        </div>

        {/* 원고이미지 업로드 영역 - 붙여넣기만 지원 */}
        <div className="flex flex-col mt-6">
          <label className="font-semibold text-gray-800 mb-1">원고 이미지</label>
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-2xl p-6 mb-2 bg-gray-50 cursor-pointer transition hover:border-blue-400 min-h-[120px]">
            {imagePreview ? (
              <div className="relative w-full flex flex-col items-center">
                <img src={imagePreview} className="max-h-52 object-contain border rounded-xl mb-2 shadow" />
                <button
                  onClick={() => { setImage(null); setImagePreview(null); }}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  이미지 제거
                </button>
              </div>
            ) : (
              <div className="text-gray-400 text-sm text-center flex flex-col items-center gap-1">
                <span className="text-2xl">🖼️</span>
                <span>여기에 이미지를 <b>Ctrl+V</b>로 붙여넣으세요</span>
                <span className="text-xs">(파일 선택 없이 캡처만 지원)</span>
              </div>
            )}
          </div>
        </div>

        {/* 급함 토글 + 바빠서 원고만 올림 버튼 */}
        <div className="flex items-center mt-6 gap-4">
          {/* 급함 토글 스위치 */}
          <button
            type="button"
            onClick={() => setIsUrgent(!isUrgent)}
            className={`relative inline-flex items-center h-8 w-16 rounded-full transition-colors duration-200 focus:outline-none border-2 ${isUrgent ? 'bg-red-500 border-red-600' : 'bg-gray-200 border-gray-300'}`}
          >
            <span
              className={`inline-block w-7 h-7 transform bg-white rounded-full shadow transition-transform duration-200 ${isUrgent ? 'translate-x-8' : 'translate-x-1'}`}
            />
            <span className={`absolute left-2 text-xs font-semibold ${isUrgent ? 'text-white' : 'text-gray-600'}`}>급함</span>
          </button>
          
          {/* 바빠서 원고만 올림 버튼 */}
          <button
            type="button"
            onClick={() => setIsJustUpload(!isJustUpload)}
            className={`px-4 py-2 rounded-xl border-2 font-semibold text-base transition-colors duration-200 shadow-sm
              ${isJustUpload ? 'bg-yellow-300 text-yellow-900 border-yellow-400 scale-105' : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-yellow-100'}`}
          >
            바빠서 원고만 올림
          </button>
        </div>

        <div className="flex justify-end space-x-4 pt-6 border-t mt-8">
          <button 
            onClick={clearForm} 
            className="bg-gray-100 text-gray-700 px-6 py-2 rounded-xl font-semibold shadow hover:bg-gray-200 transition text-base"
          >
            취소
          </button>
          <button 
            onClick={handleSubmit} 
            className="bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold px-8 py-2 rounded-xl shadow-lg hover:scale-105 transition text-base" 
            disabled={isSubmitting}
          >
            {isSubmitting ? '처리 중...' : editMode ? '수정' : '등록'}
          </button>
        </div>
      </div>
    </div>
  );
} 