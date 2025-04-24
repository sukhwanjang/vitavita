// app/components/board.tsx

'use client';
import { useEffect, useState, useCallback, ChangeEvent, ClipboardEvent } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface RequestItem {
  id: number;
  company: string;
  program: string;
  pickup_date: string;
  note: string;
  image_url: string | null;
  completed: boolean;
  is_urgent: boolean;
  is_deleted: boolean;
  created_at: string;
}

export default function Board() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [company, setCompany] = useState('');
  const [program, setProgram] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [note, setNote] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUrgent, setIsUrgent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCompleted, setShowCompleted] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);

  const fetchRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from('request')
      .select('*')
      .order('is_deleted', { ascending: true })
      .order('is_urgent', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) setError(`데이터 로딩 실패: ${error.message}`);
    else setRequests(data || []);
  }, []);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 15000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImage(file);
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setImagePreview(null);
    }
  };

  const handlePasteImage = useCallback((e: ClipboardEvent) => {
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
    let imageUrl = null;
    if (image) {
      imageUrl = await uploadImage(image);
      if (!imageUrl) {
        setIsSubmitting(false);
        return;
      }
    }

    const { error } = await supabase.from('request').insert([{
      company,
      program,
      pickup_date: pickupDate,
      note,
      image_url: imageUrl,
      is_urgent: isUrgent,
      completed: false,
      is_deleted: false
    }]);

    setIsSubmitting(false);
    if (error) setError(`등록 실패: ${error.message}`);
    else {
      clearForm();
      fetchRequests();
    }
  };

  const clearForm = () => {
    setCompany('');
    setProgram('');
    setPickupDate('');
    setNote('');
    setImage(null);
    setImagePreview(null);
    setIsUrgent(false);
    setShowForm(false);
  };

  const handleComplete = async (id: number) => {
    await supabase.from('request').update({ completed: true, is_urgent: false }).eq('id', id);
    fetchRequests();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    await supabase.from('request').update({ is_deleted: true }).eq('id', id);
    fetchRequests();
  };

  const renderCard = (item: RequestItem) => {
    const isActive = !item.completed && !item.is_deleted;
    return (
      <div key={item.id} className={`p-6 bg-white rounded-xl shadow-md border border-pink-100 flex flex-col justify-between text-[15px] h-[420px] min-w-[250px] ${item.is_urgent ? 'border-2 border-red-400' : 'hover:shadow-lg transition'}`}>
        <div className="mb-4 space-y-2">
          <p className="text-pink-800 font-semibold">업체명: <span className="ml-2">{item.company}</span></p>
          <p className="text-pink-700">프로그램명: <span className="ml-2">{item.program}</span></p>
          <p className="text-pink-600">픽업일: 📅 {item.pickup_date}</p>
          {item.note && <p className="mt-1 bg-pink-50 p-2 rounded text-sm text-pink-800">📝 {item.note}</p>}
        </div>
        {item.image_url && (
          <a href={item.image_url} target="_blank" rel="noopener noreferrer">
            <img src={item.image_url} className="w-full max-h-28 object-contain border rounded" />
          </a>
        )}
        <div className="pt-2">
          {isActive && (
            <div className="flex gap-2 justify-end">
              <button onClick={() => handleComplete(item.id)} className="px-3 py-1 bg-pink-600 text-white rounded hover:bg-pink-700 text-sm">완료</button>
              <button onClick={() => handleDelete(item.id)} className="px-3 py-1 bg-pink-400 text-white rounded hover:bg-pink-500 text-sm">삭제</button>
            </div>
          )}
          {item.completed && <span className="text-green-600 text-sm">✅ 완료됨</span>}
          {item.is_deleted && <span className="text-gray-400 text-sm">🗑 삭제됨</span>}
          {item.is_urgent && <span className="text-red-500 text-sm font-bold">🚨 긴급</span>}
        </div>
      </div>
    );
  };

  const inProgress = requests.filter(r => !r.is_deleted && !r.completed);
  const completed = requests.filter(r => !r.is_deleted && r.completed);
  const deleted = requests.filter(r => r.is_deleted);

  return (
    <div className="font-sans px-4 py-8 w-full min-h-screen overflow-x-hidden bg-gradient-to-b from-pink-100 to-white text-pink-900">
      <div className="flex justify-center mb-6">
        <img src="/logo.png" alt="Vitamin Sign Logo" className="h-16 object-contain" />
      </div>

      <div className="flex justify-end max-w-screen-2xl mx-auto mb-4 gap-2">
        <button onClick={() => setShowForm(!showForm)} className="bg-pink-700 text-white px-4 py-2 rounded hover:bg-pink-800 text-sm">
          {showForm ? '입력 닫기' : '작업 추가'}
        </button>
        <button onClick={() => setShowCompleted(!showCompleted)} className="bg-pink-200 text-pink-900 px-4 py-2 rounded hover:bg-pink-300 text-sm">
          {showCompleted ? '완료 숨기기' : '✅ 완료 보기'}
        </button>
        <button onClick={() => setShowDeleted(!showDeleted)} className="bg-pink-200 text-pink-900 px-4 py-2 rounded hover:bg-pink-300 text-sm">
          {showDeleted ? '삭제 숨기기' : '🗑 삭제 보기'}
        </button>
      </div>

      {showForm && (
        <div className="max-w-screen-2xl mx-auto bg-white border border-pink-200 p-6 rounded-xl shadow mb-8 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col">
              <label className="text-base font-medium text-pink-900 mb-1">업체명 *</label>
              <input type="text" value={company} onChange={e => setCompany(e.target.value)} className="border rounded px-3 py-2" />
            </div>
            <div className="flex flex-col">
              <label className="text-base font-medium text-pink-900 mb-1">프로그램명 *</label>
              <input type="text" value={program} onChange={e => setProgram(e.target.value)} className="border rounded px-3 py-2" />
            </div>
            <div className="flex flex-col">
              <label className="text-base font-medium text-pink-900 mb-1">픽업일 *</label>
              <input type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} className="border rounded px-3 py-2 text-pink-800" />
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-base font-medium text-pink-900 mb-1">메모</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} className="border rounded px-3 py-2" rows={3} />
          </div>

          <div className="flex flex-col">
            <label className="text-base font-medium text-pink-900 mb-1">원고 이미지</label>
            <input type="file" onChange={handleFileChange} accept="image/*" className="mb-2" />
            {imagePreview && <img src={imagePreview} className="max-h-52 object-contain border rounded" />}
          </div>

          <div className="flex items-center space-x-2">
            <input type="checkbox" checked={isUrgent} onChange={e => setIsUrgent(e.target.checked)} />
            <span className="text-base text-red-600 font-medium">🚨 급함</span>
          </div>

          <div className="flex justify-end space-x-4 pt-4 border-t">
            <button onClick={clearForm} className="bg-pink-200 px-5 py-2 rounded-md">취소</button>
            <button onClick={handleSubmit} className="bg-pink-600 text-white px-5 py-2 rounded-md" disabled={isSubmitting}>
              {isSubmitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </div>
      )}

      <section className="max-w-screen-2xl mx-auto space-y-10 pb-32">
        <div>
          <h2 className="font-semibold text-base text-pink-800 mb-2">📋 진행 중</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
            {inProgress.map(renderCard)}
          </div>
        </div>

        {showCompleted && (
          <div>
            <h2 className="font-semibold text-base text-green-700 mb-2">✅ 완료</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
              {completed.map(renderCard)}
            </div>
          </div>
        )}

        {showDeleted && (
          <div>
            <h2 className="font-semibold text-base text-pink-500 mb-2">🗑 삭제됨</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
              {deleted.map(renderCard)}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
