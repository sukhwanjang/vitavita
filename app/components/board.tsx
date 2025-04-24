// Board.tsx
'use client';
import { useEffect, useState, useCallback, ChangeEvent, ClipboardEvent } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  updated_at?: string;
  deleted_at?: string | null;
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
  const [isLoading, setIsLoading] = useState(true);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('request')
      .select('*')
      .order('is_deleted', { ascending: true })
      .order('is_urgent', { ascending: false })
      .order('created_at', { ascending: false });

    setIsLoading(false);
    if (error) {
      setError(`데이터 로딩 실패: ${error.message}`);
      setRequests([]);
    } else {
      setRequests(data || []);
    }
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

    const { error } = await supabase.from('request').insert([
      { company, program, pickup_date: pickupDate, note, image_url: imageUrl, is_urgent: isUrgent, completed: false, is_deleted: false },
    ]);

    setIsSubmitting(false);
    if (error) {
      setError(`등록 실패: ${error.message}`);
    } else {
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
    const { error } = await supabase.from('request').update({
      completed: true,
      is_urgent: false,
      updated_at: new Date().toISOString(),
    }).eq('id', id);

    if (error) setError(`완료 처리 실패: ${error.message}`);
    else fetchRequests();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('request').update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
    }).eq('id', id);

    if (error) setError(`삭제 처리 실패: ${error.message}`);
    else fetchRequests();
  };

  const renderCard = (item: RequestItem) => {
    const isActive = !item.completed && !item.is_deleted;
    const isUrgent = item.is_urgent && isActive;
    return (
      <div key={item.id} className={`p-4 bg-white rounded shadow flex flex-col space-y-2 ${isUrgent ? 'border-2 border-red-500' : ''}`}>
        <div>
          <h3 className="font-bold">{item.company}</h3>
          <p className="text-sm text-gray-500">{item.program}</p>
          <p className="text-sm">📅 {item.pickup_date}</p>
          {item.note && <p className="text-xs mt-1 bg-yellow-100 p-1 rounded">📝 {item.note}</p>}
        </div>
        {item.image_url && (
          <a href={item.image_url} target="_blank" rel="noopener noreferrer">
            <img src={item.image_url} className="w-full max-h-52 object-contain border rounded" />
          </a>
        )}
        <div className="flex justify-between items-center text-xs">
          <span>
            {item.completed && '✅ 완료'}
            {item.is_deleted && '🗑️ 삭제됨'}
            {isUrgent && '🚨 긴급'}
          </span>
          {isActive && (
            <div className="space-x-2">
              <button onClick={() => handleComplete(item.id)} className="text-green-600 hover:underline">완료</button>
              <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:underline">삭제</button>
            </div>
          )}
        </div>
      </div>
    );
  };

  const urgent = requests.filter(r => !r.is_deleted && !r.completed && r.is_urgent);
  const regular = requests.filter(r => !r.is_deleted && !r.completed && !r.is_urgent);
  const completed = requests.filter(r => !r.is_deleted && r.completed);
  const deleted = requests.filter(r => r.is_deleted);

  return (
    <div className="p-6 max-w-7xl mx-auto bg-gray-100 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">비타민사인 작업 현황판</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700">
          {showForm ? '입력 닫기' : '작업 추가'}
        </button>
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 p-3 rounded mb-4">{error}</div>}

      {showForm && (
        <div className="bg-white border p-6 rounded shadow mb-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">업체명 *</label>
              <input type="text" value={company} onChange={e => setCompany(e.target.value)} className="border rounded px-3 py-2" />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">프로그램명 *</label>
              <input type="text" value={program} onChange={e => setProgram(e.target.value)} className="border rounded px-3 py-2" />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-700 mb-1">픽업일 *</label>
              <input type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} className="border rounded px-3 py-2 text-gray-700" />
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">메모</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} className="border rounded px-3 py-2" rows={3} />
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700 mb-1">원고 이미지</label>
            <input type="file" onChange={handleFileChange} accept="image/*" className="mb-2" />
            {imagePreview && <img src={imagePreview} className="max-h-40 object-contain border rounded" />}
          </div>

          <div className="flex items-center space-x-2">
            <input type="checkbox" checked={isUrgent} onChange={e => setIsUrgent(e.target.checked)} />
            <span className="text-sm text-red-600 font-medium">🚨 급함</span>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button onClick={clearForm} className="bg-gray-200 px-4 py-2 rounded">취소</button>
            <button onClick={handleSubmit} className="bg-green-600 text-white px-4 py-2 rounded" disabled={isSubmitting}>
              {isSubmitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </div>
      )}

      <section className="space-y-8">
        <div>
          <h2 className="font-semibold text-lg text-red-600 mb-2">🔥 긴급 작업</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{urgent.map(renderCard)}</div>
        </div>
        <div>
          <h2 className="font-semibold text-lg text-blue-600 mb-2">📋 진행 중</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{regular.map(renderCard)}</div>
        </div>
        <div>
          <h2 className="font-semibold text-lg text-green-600 mb-2">✅ 완료</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{completed.map(renderCard)}</div>
        </div>
        <div>
          <h2 className="font-semibold text-lg text-gray-600 mb-2">🗑️ 삭제됨</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{deleted.map(renderCard)}</div>
        </div>
      </section>
    </div>
  );
}
