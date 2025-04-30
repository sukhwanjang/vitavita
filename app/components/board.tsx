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
  creator?: string;
}

export default function Board() {
  const [authorized, setAuthorized] = useState(false);
const [passwordInput, setPasswordInput] = useState('')
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [creator, setCreator] = useState('');
  const [selectedItem, setSelectedItem] = useState<RequestItem | null>(null);
  useEffect(() => {
    if (selectedItem) {
      const timer = setTimeout(() => {
        setSelectedItem(null);
      }, 2000); // 2초 후 자동 닫힘
      return () => clearTimeout(timer);
    }
  }, [selectedItem]);
  const [fadeOut, setFadeOut] = useState(false);
  const [company, setCompany] = useState('');
  const [savedScrollY, setSavedScrollY] = useState(0);
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
  const handleCloseModal = () => {
    setFadeOut(true);
    setTimeout(() => {
      setModalImage(null);
      setFadeOut(false);
      window.scrollTo({ top: savedScrollY, behavior: "smooth" });
    }, 500);
  };
  
  

  const fetchRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from('request')
      .select('*')
      .order('is_deleted', { ascending: true })
      .order('is_urgent', { ascending: false })
      .order('created_at', { ascending: false });
  
    if (error) {
      setError(`데이터 로딩 실패: ${error.message}`);
      return;
    }
  
    // 완료 항목 100개 초과 시 오래된 것부터 삭제
    const completed = data.filter(r => r.completed && !r.is_deleted);
    if (completed.length > 100) {
      const toDelete = completed.slice(100);
      await Promise.all(toDelete.map(r =>
        supabase.from('request').delete().eq('id', r.id)
      ));
    }
  
    // 삭제된 항목 10개 초과 시 Supabase에서 완전 삭제
    const deleted = data.filter(r => r.is_deleted);
    if (deleted.length > 10) {
      const toDelete = deleted.slice(10);
      await Promise.all(toDelete.map(r =>
        supabase.from('request').delete().eq('id', r.id)
      ));
    }
  
    setRequests(data || []);
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
    if (!creator) {
      setError('작업자를 선택해주세요.');
      setIsSubmitting(false);
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
        creator, // 이 필드가 올바르게 설정되어야 합니다.
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
  const handleRecover = async (id: number) => {
    await supabase.from('request').update({ completed: false }).eq('id', id);
    fetchRequests();
  };
  const handleImageClick = (url: string) => {
    setSavedScrollY(window.scrollY); // 현재 위치 저장
    setModalImage(url);               // 이미지 저장
    window.scrollTo({ top: 0, behavior: "smooth" }); // 부드럽게 올라가기
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('정말 삭제하시겠습니까?')) return;
    await supabase.from('request').update({ is_deleted: true }).eq('id', id);
    fetchRequests();
  };
  const handlePrintTodayWork = () => {
    const now = new Date();
    const koreaTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const today = koreaTime.toISOString().slice(0, 10);
  
    const todayRequests = requests.filter(r => {
      const createdAtKorea = new Date(new Date(r.created_at).getTime() + 9 * 60 * 60 * 1000);
      return createdAtKorea.toISOString().slice(0, 10) === today;
    }).reverse();
  
    let html = `
      <html>
      <head><title>오늘 작업 출력</title></head>
      <body style="font-family: sans-serif; padding: 10px; font-size: 12px; line-height: 1.4;">
      <h1 style="font-size: 16px;">오늘 작업한 내용 (한국시간)</h1>
      <table border="1" cellspacing="0" cellpadding="6" style="width:100%; border-collapse: collapse; font-size:12px;">
        <thead style="background-color:#f0f0f0;">
          <tr>
            <th>업체명 / 작업자</th>
            <th>프로그램명</th>
            <th>메모</th>
            <th>완료 여부</th>
          </tr>
        </thead>
        <tbody>
    `;
  
    todayRequests.forEach((item) => {
      html += `
        <tr>
          <td>${item.company}${item.creator ? ` / ${item.creator}` : ''}</td>
          <td>${item.program}</td>
          <td>${item.note || '-'}</td> <!-- 메모 출력! -->
          <td>${item.completed ? '완료됨' : '아직 완료 안 됨'}</td>
        </tr>
      `;
    });
  
    html += `
        </tbody>
      </table>
      </body>
      </html>
    `;
  
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  };
  
  

  const renderCard = (item: RequestItem) => {
    const isActive = !item.completed && !item.is_deleted;
  
    return (
      <div
  key={item.id}
  onClick={() => setSelectedItem(item)}
  className={`flex flex-col justify-between rounded-2xl shadow-md overflow-hidden border-2 cursor-pointer ${
    item.completed ? 'border-gray-300' : item.is_urgent ? 'border-red-500 animate-urgent' : 'border-blue-500'
  }`}
>


        {/* 상단 바 */}
        <div
  className={`h-8 ${
    item.completed
      ? 'bg-gray-200'
      : (() => {
          const daysLeft = item.pickup_date
            ? Math.ceil(
                (new Date(item.pickup_date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0))
                / (1000 * 60 * 60 * 24)
              )
            : null;
          if (daysLeft === 0) return 'bg-red-400'; // 오늘만 빨간색
          return item.is_urgent ? 'bg-red-500' : 'bg-blue-500'; // 나머지는 급함 빨간/일반 파란
        })()
  } flex items-center justify-center text-white text-xs font-bold`}
>

  {item.completed ? '완료' : item.is_urgent ? '급함' : '진행중'}
</div>

  
        {/* 카드 본문 */}
        <div className="flex flex-col p-4 space-y-2 bg-white h-full">
  <div>
    <p className="text-lg font-bold truncate">{item.company}</p>
    <p className="text-sm text-gray-600 truncate">{item.program}</p>
  </div>

  {item.image_url && (
    <img
      src={item.image_url}
      onClick={() => handleImageClick(item.image_url!)}
      className="cursor-pointer w-full h-32 object-contain rounded-md border bg-gray-50"
    />
  )}

  {/* 기존 픽업일 표시 */}
  <div className={`text-sm font-bold ${
  (() => {
    const daysLeft = item.pickup_date
      ? Math.ceil(
          (new Date(item.pickup_date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0))
          / (1000 * 60 * 60 * 24)
        )
      : null;
    return daysLeft === 0 ? 'text-red-500' : 'text-gray-700';
  })()
}`}>
  📅 픽업 {item.pickup_date ? (() => {
    const daysLeft = Math.ceil(
      (new Date(item.pickup_date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0))
      / (1000 * 60 * 60 * 24)
    );
    if (daysLeft === 0) return '오늘';
    if (daysLeft > 0) return `D-${daysLeft}`;
    return '지남';
  })() : '-'}
</div>

  {/* 메모 */}
  {item.note && (
    <div className="text-xs bg-gray-100 p-2 rounded">{item.note}</div>
  )}

  
          {/* 버튼 영역 */}
          <div className="pt-2 flex flex-wrap gap-2 items-center justify-end">
  {isActive && (
    <>
      {/* 업로드 시간 추가 */}
      <span className="text-[10px] text-gray-400 mr-auto">
        🕒 {new Date(item.created_at).toLocaleString('ko-KR', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })}
      </span>

      <button
        onClick={() => handleEdit(item)}
        className="px-3 py-1 bg-blue-400 text-white rounded hover:bg-blue-500 text-xs"
      >
        수정
      </button>
      <button
        onClick={() => handleComplete(item.id)}
        className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs"
      >
        완료
      </button>
      <button
        onClick={() => handleDelete(item.id)}
        className="px-3 py-1 bg-gray-400 text-white rounded hover:bg-gray-500 text-xs"
      >
        삭제
      </button>
    </>
  )}

  
  {item.completed && (
  <div className="flex items-center gap-2">
    <span className="text-green-600 text-xs">✅ 완료됨</span>
    <button
      onClick={() => handleRecover(item.id)}
      className="text-xs text-blue-500 underline hover:text-blue-700"
    >
      복구
    </button>
    <button
      onClick={async () => {
        if (window.confirm('정말 삭제하시겠습니까?')) {
          await supabase.from('request').delete().eq('id', item.id);
          fetchRequests();
        }
      }}
      className="text-xs text-red-500 underline hover:text-red-700"
    >
      삭제
    </button>
  </div>
)}

{item.is_deleted && (
  <div className="flex items-center gap-2">
    <span className="text-gray-400 text-xs">🗑 삭제됨</span>
    <button
      onClick={async () => {
        await supabase.from('request').update({ is_deleted: false }).eq('id', item.id);
        fetchRequests();
      }}
      className="text-xs text-blue-500 underline hover:text-blue-700"
    >
      복구
    </button>
    <button
      onClick={async () => {
        if (window.confirm('진짜로 완전 삭제할까요?')) {
          await supabase.from('request').delete().eq('id', item.id);
          fetchRequests();
        }
      }}
      className="text-xs text-red-500 underline hover:text-red-700"
    >
      완전 삭제
    </button>
  </div>
)}


          </div>
        </div>
      </div>
    );
  };
    
  const inProgress = requests.filter(r => !r.is_deleted && !r.completed);
  const completed = requests.filter(r => !r.is_deleted && r.completed);
  const deleted = requests.filter(r => r.is_deleted);

  return (
    <div className="relative bg-[#F8F6F1] min-h-screen text-gray-900 px-4 py-8 font-sans">
      {selectedItem && (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white p-8 rounded-2xl shadow-lg max-w-md w-full">
      <h2 className="text-2xl font-bold mb-4">상세 정보</h2>
      <div className="space-y-2 text-sm text-gray-700">
        <div><strong>업체명:</strong> {selectedItem.company}</div>
        <div><strong>프로그램명:</strong> {selectedItem.program}</div>
        <div><strong>메모:</strong> {selectedItem.note || '-'}</div>
        <div><strong>업로드:</strong> {new Date(selectedItem.created_at).toLocaleString('ko-KR', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })}</div>
        <div><strong>픽업일:</strong> {selectedItem.pickup_date || '-'}</div>
      </div>
      <div className="mt-6 flex justify-end">
        <button
          onClick={() => setSelectedItem(null)}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-sm"
        >
          닫기
        </button>
      </div>
    </div>
  </div>
)}



      {/* 이미지 확대 모달 */}
      {modalImage && (
  <div
    className={`flex flex-col items-center justify-center mt-10 transition-opacity duration-500 ${
      fadeOut ? 'opacity-0' : 'opacity-100'
    }`}
  >
    <img src={modalImage} className="max-w-full h-auto object-contain" />
    <button
      onClick={handleCloseModal}
      className="mt-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
    >
      닫기
    </button>
  </div>
)}


      {/* 로고 */}
      <div className="relative z-10 flex justify-center mb-2">
  <img src="/logo.png" alt="Vitamin Sign Logo" className="h-16 object-contain" />
</div>


      {/* 상단 버튼 통합 */}
<div className="relative z-10 flex justify-between items-center max-w-screen-2xl mx-auto mb-4 gap-2">
  {/* 왼쪽: 오늘 작업 출력 */}
  <button
    onClick={handlePrintTodayWork}
    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-sm"
  >
    오늘 작업 출력
  </button>

  {/* 오른쪽: 작업 추가, 완료 보기, 삭제 보기 */}
  <div className="flex gap-2">
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
</div>

      {/* 입력 폼 */}
      {showForm && (
        <div className="relative z-10 max-w-screen-2xl mx-auto bg-white border p-6 rounded-xl shadow mb-8 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col">
              <label className="font-medium text-gray-800 mb-1">업체명 *</label>
              <input type="text" value={company} onChange={e => setCompany(e.target.value)} className="border rounded px-3 py-2" />
            </div>
            <div className="flex flex-col">
              <label className="font-medium text-gray-800 mb-1">프로그램명 *</label>
              <input type="text" value={program} onChange={e => setProgram(e.target.value)} className="border rounded px-3 py-2" />
            </div>
            <div className="flex flex-col">
  <label className="font-medium text-gray-800 mb-2">작업자 선택</label>
  <div className="grid grid-cols-2 gap-2">
    {['박혜경', '김한별', '장석환', '정수원'].map((name) => (
      <button
        key={name}
        onClick={() => setCreator(name)}
        className={`p-2 rounded-xl border text-sm font-semibold ${
          creator === name
            ? 'bg-blue-500 text-white border-blue-600'
            : 'bg-white text-gray-800 border-gray-300'
        } hover:shadow`}
      >
        {name}
      </button>
    ))}
  </div>
  {error && <p className="text-red-500 text-sm">{error}</p>}
</div>
            <div className="flex flex-col">
              <label className="font-medium text-gray-800 mb-1">픽업일 *</label>
              <input type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} className="border rounded px-3 py-2 text-gray-800" />
            </div>
          </div>

          <div className="flex flex-col">
            <label className="font-medium text-gray-800 mb-1">메모</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} className="border rounded px-3 py-2" rows={3} />
          </div>

          <div className="flex flex-col">
            <label className="font-medium text-gray-800 mb-1">원고 이미지</label>
            <input type="file" onChange={handleFileChange} accept="image/*" className="mb-2" />
            {imagePreview && <img src={imagePreview} className="max-h-52 object-contain border rounded" />}
          </div>

          <div className="flex items-center space-x-2">
            <input type="checkbox" checked={isUrgent} onChange={e => setIsUrgent(e.target.checked)} />
            <span className="text-sm text-pink-500 font-medium">🌸 급함</span>
          </div>

          <div className="flex justify-end space-x-4 pt-4 border-t">
            <button onClick={clearForm} className="bg-gray-200 px-5 py-2 rounded-md">취소</button>
            <button onClick={handleSubmit} className="bg-black text-white px-5 py-2 rounded-md" disabled={isSubmitting}>
              {isSubmitting ? '처리 중...' : editMode ? '수정' : '등록'}
            </button>
          </div>
        </div>
      )}

      {/* 카드 리스트 */}
      <section className="relative z-10 max-w-screen-2xl mx-auto space-y-10 pb-32">
        <div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {inProgress.map(renderCard)}
          </div>
        </div>

        {showCompleted && (
          <div>
            <h2 className="font-semibold text-base text-green-700 mb-2">✅ 완료</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {completed.map(renderCard)}
            </div>
          </div>
        )}

        {showDeleted && (
          <div>
            <h2 className="font-semibold text-base text-gray-500 mb-2">🗑 삭제됨</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {deleted.map(renderCard)}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
