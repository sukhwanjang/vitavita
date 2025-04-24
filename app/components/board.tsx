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
    const isUrgent = item.is_urgent && isActive;
    return (
      <div key={item.id} className={`p-6 bg-white rounded-xl shadow flex flex-col space-y-3 text-base font-sans ${isUrgent ? 'border-2 border-sky-400' : ''}`}>
        <div>
          <p><strong>업체명:</strong> {item.company}</p>
          <p><strong>프로그램명:</strong> {item.program}</p>
          <p><strong>픽업일:</strong> 📅 {item.pickup_date}</p>
          {item.note && <p className="text-sm mt-2 bg-blue-50 p-2 rounded">📝 {item.note}</p>}
        </div>
        {item.image_url && (
          <a href={item.image_url} target="_blank" rel="noopener noreferrer">
            <img src={item.image_url} className="w-full max-h-56 object-contain border rounded" />
          </a>
        )}
        {isActive && (
          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => handleComplete(item.id)} className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-sm">
              완료
            </button>
            <button onClick={() => handleDelete(item.id)} className="px-4 py-2 bg-sky-600 text-white rounded hover:bg-sky-700 text-sm">
              삭제
            </button>
          </div>
        )}
        {item.completed && <span className="text-emerald-500 text-sm">✅ 완료됨</span>}
        {item.is_deleted && <span className="text-gray-400 text-sm">🗑️ 삭제됨</span>}
        {isUrgent && <span className="text-red-500 text-sm">🚨 긴급</span>}
      </div>
    );
  };

  const urgent = requests.filter(r => !r.is_deleted && !r.completed && r.is_urgent);
  const regular = requests.filter(r => !r.is_deleted && !r.completed && !r.is_urgent);
  const completed = requests.filter(r => !r.is_deleted && r.completed);
  const deleted = requests.filter(r => r.is_deleted);

  return (
    <div className="font-sans p-6 w-full bg-gradient-to-br from-blue-50 to-sky-100 min-h-screen">
      <div className="flex justify-between items-center mb-6 max-w-screen-2xl mx-auto">
        <h1 className="text-3xl font-bold text-blue-900">비타민사인 작업 현황판</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700 text-base">
          {showForm ? '입력 닫기' : '작업 추가'}
        </button>
      </div>

      {error && <div className="max-w-screen-2xl mx-auto bg-blue-100 border border-blue-400 text-blue-800 p-4 rounded mb-6">{error}</div>}

      {showForm && (
        <div className="max-w-screen-2xl mx-auto bg-white border p-6 rounded-xl shadow mb-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="flex flex-col">
              <label className="text-base font-medium text-blue-800 mb-1">업체명 *</label>
              <input type="text" value={company} onChange={e => setCompany(e.target.value)} className="border rounded px-3 py-2" />
            </div>
            <div className="flex flex-col">
              <label className="text-base font-medium text-blue-800 mb-1">프로그램명 *</label>
              <input type="text" value={program} onChange={e => setProgram(e.target.value)} className="border rounded px-3 py-2" />
            </div>
            <div className="flex flex-col">
              <label className="text-base font-medium text-blue-800 mb-1">픽업일 *</label>
              <input type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} className="border rounded px-3 py-2 text-blue-900" />
            </div>
          </div>

          <div className="flex flex-col">
            <label className="text-base font-medium text-blue-800 mb-1">메모</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} className="border rounded px-3 py-2" rows={4} />
          </div>

          <div className="flex flex-col">
            <label className="text-base font-medium text-blue-800 mb-1">원고 이미지</label>
            <input type="file" onChange={handleFileChange} accept="image/*" className="mb-2" />
            {imagePreview && <img src={imagePreview} className="max-h-52 object-contain border rounded" />}
          </div>

          <div className="flex items-center space-x-2">
            <input type="checkbox" checked={isUrgent} onChange={e => setIsUrgent(e.target.checked)} />
            <span className="text-base text-sky-600 font-medium">🚨 급함</span>
          </div>

          <div className="flex justify-end space-x-4 pt-4 border-t">
            <button onClick={clearForm} className="bg-slate-200 px-5 py-2 rounded">취소</button>
            <button onClick={handleSubmit} className="bg-emerald-600 text-white px-5 py-2 rounded" disabled={isSubmitting}>
              {isSubmitting ? '등록 중...' : '등록'}
            </button>
          </div>
        </div>
      )}

      <section className="max-w-screen-2xl mx-auto space-y-10">
        {([
          ['🔥 긴급 작업', urgent, 'text-sky-600'],
          ['📋 진행 중', regular, 'text-blue-700'],
          ['✅ 완료', completed, 'text-emerald-600'],
          ['🗑️ 삭제됨', deleted, 'text-slate-500']
        ] as const).map(([title, items, color], i) => (
          <div key={i}>
            <h2 className={`font-semibold text-2xl ${color} mb-4`}>{title}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {(items as RequestItem[]).map(renderCard)}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
