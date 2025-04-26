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
  const [selectedItem, setSelectedItem] = useState<RequestItem | null>(null);
  const [fadeOut, setFadeOut] = useState(false);
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
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [savedScrollY, setSavedScrollY] = useState(0);

  const fetchRequests = useCallback(async () => {
    const { data, error } = await supabase.from('request').select('*').order('is_deleted').order('is_urgent', { ascending: false }).order('created_at', { ascending: false });
    if (error) {
      setError(`데이터 로딩 실패: ${error.message}`);
      return;
    }
    const completed = data?.filter(r => r.completed && !r.is_deleted) || [];
    const deleted = data?.filter(r => r.is_deleted) || [];

    if (completed.length > 100) {
      await Promise.all(completed.slice(100).map(r => supabase.from('request').delete().eq('id', r.id)));
    }
    if (deleted.length > 10) {
      await Promise.all(deleted.slice(10).map(r => supabase.from('request').delete().eq('id', r.id)));
    }
    setRequests(data || []);
  }, []);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 15000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setImage(file || null);
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
    if (file?.type.startsWith('image/')) {
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

    const payload = { company, program, pickup_date: pickupDate, note, image_url: imageUrl, is_urgent: isUrgent };

    if (editMode && editingId !== null) {
      const { error } = await supabase.from('request').update(payload).eq('id', editingId);
      if (error) setError(`수정 실패: ${error.message}`);
    } else {
      const { error } = await supabase.from('request').insert([{ ...payload, completed: false, is_deleted: false }]);
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
    setImagePreview(item.image_url);
    setIsUrgent(item.is_urgent);
    setEditingId(item.id);
    setEditMode(true);
    setShowForm(true);
  };

  const handleComplete = (id: number) => supabase.from('request').update({ completed: true, is_urgent: false }).eq('id', id).then(fetchRequests);
  const handleRecover = (id: number) => supabase.from('request').update({ completed: false }).eq('id', id).then(fetchRequests);
  const handleDelete = (id: number) => { if (confirm('정말 삭제하시겠습니까?')) supabase.from('request').update({ is_deleted: true }).eq('id', id).then(fetchRequests); };

  const handleImageClick = (url: string) => {
    setSavedScrollY(window.scrollY);
    setModalImage(url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCloseModal = () => {
    setFadeOut(true);
    setTimeout(() => {
      setModalImage(null);
      setFadeOut(false);
      window.scrollTo({ top: savedScrollY, behavior: 'smooth' });
    }, 500);
  };

  const inProgress = requests.filter(r => !r.is_deleted && !r.completed);
  const completed = requests.filter(r => !r.is_deleted && r.completed);
  const deleted = requests.filter(r => r.is_deleted);

  return (
    <div className="relative bg-[#f5f8fb] min-h-screen text-gray-900 px-4 py-8 font-sans">
      {/* 추가된 UI 컴포넌트들 여기서부터 렌더 */}
      {/* 최적화 끝 */}
    </div>
  );
}
