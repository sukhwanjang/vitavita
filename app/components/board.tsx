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

    const { error } = await supabase.from('request').insert([
      { company, program, pickup_date: pickupDate, note, image_url: imageUrl, is_urgent: isUrgent, completed: false, is_deleted: false },
    ]);

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
    const { error } = await supabase.from('request').update({
      completed: true,
      is_urgent: false,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    if (!error) fetchRequests();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    const { error } = await supabase.from('request').update({
      is_deleted: true,
      deleted_at: new Date().toISOString(),
    }).eq('id', id);
    if (!error) fetchRequests();
  };

  const renderCard = (item: RequestItem) => {
    const isActive = !item.completed && !item.is_deleted;
    return (
      <div key={item.id} className={`p-4 bg-white rounded-xl shadow flex flex-col space-y-2 text-sm ${item.is_urgent ? 'border-2 border-red-400' : 'border border-slate-200'} h-[300px]`}>
        <div className="flex flex-col flex-grow">
          <p><strong>업체명:</strong> {item.company}</p>
          <p><strong>프로그램명:</strong> {item.program}</p>
          <p><strong>픽업일:</strong> 📅 {item.pickup_date}</p>
          {item.note && <p className="mt-1 bg-blue-50 p-1 rounded text-xs">📝 {item.note}</p>}
        </div>
        {item.image_url && (
          <a href={item.image_url} target="_blank" rel="noopener noreferrer">
            <img src={item.image_url} className="w-full max-h-24 object-contain border rounded" />
          </a>
        )}
        {isActive && (
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => handleComplete(item.id)} className="px-3 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-xs">완료</button>
            <button onClick={() => handleDelete(item.id)} className="px-3 py-1 bg-sky-600 text-white rounded hover:bg-sky-700 text-xs">삭제</button>
          </div>
        )}
        {item.completed && <span className="text-emerald-500 text-xs">✅ 완료됨</span>}
        {item.is_deleted && <span className="text-gray-400 text-xs">🗑️ 삭제됨</span>}
        {item.is_urgent && <span className="text-red-500 text-xs font-bold">🚨 긴급</span>}
      </div>
    );
  };

  const inProgress = requests.filter(r => !r.is_deleted && !r.completed);
  const completed = requests.filter(r => !r.is_deleted && r.completed);
  const deleted = requests.filter(r => r.is_deleted);

  return (
    <div className="font-sans px-4 py-8 w-full bg-gradient-to-b from-sky-100 to-white min-h-screen overflow-x-hidden">
      <div className="flex justify-center mb-6">
        <img src="/logo.png" alt="Vitamin Sign Logo" className="h-16 object-contain" />
      </div>

      <div className="flex justify-end max-w-screen-xl mx-auto mb-4">
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 text-sm">
          {showForm ? '입력 닫기' : '작업 추가'}
        </button>
      </div>

      {error && <div className="max-w-screen-xl mx-auto bg-red-50 border border-red-400 text-red-700 p-4 rounded mb-4">{error}</div>}

      <section className="max-w-screen-xl mx-auto space-y-10 pb-32">
        <div>
          <h2 className="font-semibold text-base text-blue-700 mb-2">📋 진행 중</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {inProgress.map(renderCard)}
          </div>
        </div>
      </section>

      {/* 아래는 별도 영역으로 분리해 스크롤 시 보이도록 */}
      <section className="max-w-screen-xl mx-auto space-y-10 pt-12 border-t">
        <div>
          <h2 className="font-semibold text-base text-emerald-600 mb-2">✅ 완료</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {completed.map(renderCard)}
          </div>
        </div>

        <div>
          <h2 className="font-semibold text-base text-slate-500 mb-2">🗑️ 삭제됨</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {deleted.map(renderCard)}
          </div>
        </div>
      </section>
    </div>
  );
}
