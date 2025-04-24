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
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

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
        company, program, pickup_date: pickupDate, note,
        image_url: imageUrl, is_urgent: isUrgent
      }).eq('id', editingId);

      if (error) setError(`수정 실패: ${error.message}`);
    } else {
      const { error } = await supabase.from('request').insert([{
        company, program, pickup_date: pickupDate, note,
        image_url: imageUrl, is_urgent: isUrgent, completed: false, is_deleted: false
      }]);
      if (error) setError(`등록 실패: ${error.message}`);
    }

    setIsSubmitting(false);
    clearForm();
    fetchRequests();
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
    setEditMode(false);
    setEditingId(null);
  };

  const handleEdit = (item: RequestItem) => {
    setCompany(item.company);
    setProgram(item.program);
    setPickupDate(item.pickup_date);
    setNote(item.note);
    setImagePreview(item.image_url ?? null);
    setIsUrgent(item.is_urgent);
    setEditingId(item.id);
    setEditMode(true);
    setShowForm(true);
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
      <div key={item.id} className="p-6 bg-white rounded-xl shadow-md border border-gray-200 flex flex-col justify-between text-sm h-[420px] min-w-[250px]">
        <div className="mb-4 space-y-2">
          <p><strong>업체명:</strong> {item.company}</p>
          <p><strong>프로그램명:</strong> {item.program}</p>
          <p><strong>픽업일:</strong> 📅 {item.pickup_date}</p>
          {item.note && <p className="bg-gray-100 p-2 rounded">📝 {item.note}</p>}
        </div>
        {item.image_url && (
          <a href={item.image_url} target="_blank" rel="noopener noreferrer">
            <img src={item.image_url} className="w-full max-h-28 object-contain border rounded" />
          </a>
        )}
        <div className="pt-2 flex flex-wrap gap-2 justify-end">
          {isActive && (
            <>
              <button onClick={() => handleEdit(item)} className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-xs">수정</button>
              <button onClick={() => handleComplete(item.id)} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs">완료</button>
              <button onClick={() => handleDelete(item.id)} className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-xs">삭제</button>
            </>
          )}
          {item.completed && <span className="text-green-600 text-xs">✅ 완료됨</span>}
          {item.is_deleted && <span className="text-gray-400 text-xs">🗑 삭제됨</span>}
        </div>
      </div>
    );
  };

  const inProgress = requests.filter(r => !r.is_deleted && !r.completed);
  const completed = requests.filter(r => !r.is_deleted && r.completed);
  const deleted = requests.filter(r => r.is_deleted);

  return (
    <div className="relative bg-gradient-to-b from-white via-slate-50 to-gray-100 min-h-screen text-gray-900 px-4 py-8 font-sans">

      {/* 벚꽃 애니메이션 */}
      {[...Array(15)].map((_, i) => (
        <div
          key={i}
          className="absolute w-6 h-6 bg-[url('/petal.png')] bg-contain bg-no-repeat animate-fall"
          style={{
            left: `${Math.random() * 100}%`,
            animationDuration: `${5 + Math.random() * 10}s`,
            animationDelay: `${Math.random() * 5}s`,
            zIndex: 0,
          }}
        />
      ))}

      <div className="relative z-10 flex justify-center mb-6">
        <img src="/logo.png" alt="Vitamin Sign Logo" className="h-16 object-contain" />
      </div>

      <div className="relative z-10 flex justify-end max-w-screen-2xl mx-auto mb-4 gap-2">
        <button onClick={() => setShowForm(!showForm)} className="bg-black text-white px-4 py-2 rounded hover:bg-gray-900 text-sm">
          {showForm ? '입력 닫기' : editMode ? '수정 중...' : '작업 추가'}
        </button>
        <button onClick={() => setShowCompleted(!showCompleted)} className="bg-gray-200 text-black px-4 py-2 rounded hover:bg-gray-300 text-sm">
          {showCompleted ? '완료 숨기기' : '✅ 완료 보기'}
        </button>
        <button onClick={() => setShowDeleted(!showDeleted)} className="bg-gray-200 text-black px-4 py-2 rounded hover:bg-gray-300 text-sm">
          {showDeleted ? '삭제 숨기기' : '🗑 삭제 보기'}
        </button>
      </div>

      {/* 입력 폼, 카드 리스트는 그대로 유지 */}
      {/* 여기에 기존 폼과 카드 리스트 코드 이어서 붙이면 돼 */}

    </div>
  );
}
