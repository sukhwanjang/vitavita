'use client';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

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
  is_just_upload?: boolean;
  created_at: string;
  updated_at?: string;
  creator: string;
}

export default function Board({ only }: { only?: 'completed' | 'deleted' | 'justupload' }) {
  const [requests, setRequests] = useState<RequestItem[]>([]);
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
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [creator, setCreator] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isJustUpload, setIsJustUpload] = useState(false);
  const [zoom, setZoom] = useState(1);
  const router = useRouter();

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        company, program, pickup_date: pickupDate, note,
        image_url: imageUrl, is_urgent: isUrgent, is_just_upload: isJustUpload
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
        creator, // 🔥 여기에 추가!
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
    // UTC 기준 한국시간(+9시간)으로 변환
    const koreaTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const today = koreaTime.toISOString().slice(0, 10); // 한국 날짜로 today 결정

    const todayRequests = requests.filter(r => {
      const createdAtKorea = new Date(new Date(r.created_at).getTime() + 9 * 60 * 60 * 1000);
      return createdAtKorea.toISOString().slice(0, 10) === today && !r.is_deleted;
    }).reverse();

    // 작업자별로 그룹화
    const grouped = todayRequests.reduce((acc, item) => {
      const key = item.creator || '미지정';
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {} as Record<string, RequestItem[]>);

    let html = `
      <html>
      <head>
        <title>오늘 작업 출력</title>
        <style>
          body {
            font-family: 'Pretendard', 'Noto Sans KR', sans-serif;
            background: #f8fafc;
            color: #222;
            margin: 0;
            padding: 32px 0;
          }
          h1 {
            font-size: 22px;
            font-weight: 700;
            margin-bottom: 32px;
            text-align: center;
            letter-spacing: -1px;
          }
          .creator-block {
            margin-bottom: 40px;
            background: #fff;
            border-radius: 18px;
            box-shadow: 0 2px 12px 0 #0001;
            padding: 24px 32px;
          }
          .creator-title {
            font-size: 18px;
            font-weight: 600;
            color: #2563eb;
            margin-bottom: 18px;
            letter-spacing: -0.5px;
          }
          table {
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            background: #f9fafb;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 1px 4px 0 #0001;
          }
          th, td {
            padding: 10px 12px;
            font-size: 14px;
            text-align: left;
          }
          th {
            background: #e0e7ef;
            color: #222;
            font-weight: 700;
            border-bottom: 2px solid #cbd5e1;
          }
          tr:nth-child(even) td {
            background: #f3f6fa;
          }
          tr:nth-child(odd) td {
            background: #fff;
          }
          td {
            border-bottom: 1px solid #e5e7eb;
          }
          @media print {
            body { background: #fff; padding: 0; }
            .creator-block { box-shadow: none; padding: 12px 0; }
            table { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <h1>오늘 작업한 내용 (한국시간)</h1>
    `;

    Object.entries(grouped).forEach(([creator, items]) => {
      html += `<div class="creator-block">`;
      html += `<div class="creator-title">${creator}</div>`;
      html += `
        <table>
          <thead>
            <tr>
              <th>업체명</th>
              <th>프로그램명</th>
              <th>업로드 시간</th>
              <th>완료 여부</th>
            </tr>
          </thead>
          <tbody>
      `;
      items.forEach((item) => {
        html += `
          <tr>
            <td>${item.company}</td>
            <td>${item.program}</td>
            <td>${new Date(item.created_at).toLocaleString('ko-KR')}</td>
            <td>${item.completed ? '완료됨' : '아직 완료 안 됨'}</td>
          </tr>
        `;
      });
      html += `</tbody></table></div>`;
    });

    html += `</body></html>`;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  };
  

  const handlePrintImage = (imageUrl: string, company: string, program: string) => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const html = `
        <html>
          <head>
            <title>${company} - ${program} 출력</title>
            <style>
              body {
                margin: 0;
                padding: 20px;
                display: flex;
                flex-direction: column;
                align-items: center;
                font-family: sans-serif;
              }
              .header {
                text-align: center;
                margin-bottom: 20px;
              }
              .image-container {
                max-width: 100%;
                height: auto;
              }
              img {
                max-width: 100%;
                height: auto;
                object-fit: contain;
              }
              @media print {
                body {
                  padding: 0;
                }
                .header {
                  margin-bottom: 10px;
                }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>${company}</h2>
              <p>${program}</p>
            </div>
            <div class="image-container">
              <img src="${imageUrl}" alt="${company} - ${program}" />
            </div>
          </body>
        </html>
      `;
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const renderCard = (item: RequestItem) => {
    const isActive = !item.completed && !item.is_deleted;
    // 날짜 계산
    const daysLeft = item.pickup_date
      ? Math.ceil(
          (new Date(item.pickup_date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0))
          / (1000 * 60 * 60 * 24)
        )
      : null;
    // 색상 우선순위: 급함 > 오늘 > 내일이후 > 지남
    const barColor = item.is_urgent
      ? 'bg-orange-500'
      : daysLeft === 0
        ? 'bg-red-400'
        : daysLeft > 0
          ? 'bg-blue-500'
          : 'bg-black';
    const barText = item.is_urgent
      ? '급함'
      : daysLeft === 0
        ? '오늘까지'
        : daysLeft > 0
          ? `D-${daysLeft}`
          : '지남';
    return (
      <div
        key={item.id}
        className={`flex flex-col justify-between rounded-2xl shadow-lg overflow-hidden border bg-white transition-transform duration-200 hover:scale-[1.02] hover:shadow-2xl ${
          item.completed
            ? 'border-gray-200'
            : item.is_urgent
            ? 'border-orange-400'
            : daysLeft === 0
              ? 'border-red-300'
              : daysLeft > 0
                ? 'border-blue-300'
                : 'border-gray-300'
        }`}
      >
        {/* 상단 상태 뱃지 */}
        <div className="flex items-center justify-start px-4 pt-4">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold shadow-sm
            ${item.is_urgent ? 'bg-orange-100 text-orange-700' : daysLeft === 0 ? 'bg-red-100 text-red-700' : daysLeft > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-800 text-white'}`}
          >
            {item.is_urgent && <span className="mr-1">⚡</span>}
            {daysLeft === 0 && !item.is_urgent && <span className="mr-1">📅</span>}
            {daysLeft < 0 && !item.is_urgent && <span className="mr-1">⏰</span>}
            {barText}
          </span>
        </div>
        {/* 카드 본문 */}
        <div className="flex flex-col p-4 space-y-3 bg-white h-full">
          <div>
            <p className="text-xl font-extrabold text-gray-900 truncate mb-1">{item.company}</p>
            <p className="text-sm text-gray-500 truncate">{item.program}</p>
          </div>
          <div className="flex justify-center items-center w-full min-h-[96px]">
            {item.image_url ? (
              <img
                src={item.image_url}
                onClick={() => setModalImage(item.image_url!)}
                className="cursor-pointer w-full h-32 object-contain rounded-lg border bg-gray-50 shadow-sm transition-transform duration-200 hover:scale-105 hover:shadow-lg"
                alt="작업 이미지"
              />
            ) : (
              <div className="flex flex-col items-center justify-center w-full h-24 text-gray-300 text-3xl">
                <span className="material-icons">image_not_supported</span>
                <span className="text-xs mt-1">이미지 없음</span>
              </div>
            )}
          </div>
          {/* 기존 픽업일 표시 */}
          <div className={`text-sm font-bold mt-2 ${daysLeft === 0 ? 'text-red-500' : daysLeft < 0 ? 'text-gray-800' : 'text-gray-700'}`}>📅 픽업 {item.pickup_date ? (() => {
            const daysLeft = Math.ceil(
              (new Date(item.pickup_date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0))
              / (1000 * 60 * 60 * 24)
            );
            if (daysLeft === 0) return '오늘';
            if (daysLeft > 0) return `D-${daysLeft}`;
            return '지남';
          })() : '-'}</div>
          {/* 메모 */}
          {item.note && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-2 mt-2 text-xs text-gray-800 rounded flex items-start gap-2 shadow-sm">
              <span className="text-lg">📝</span>
              <span>{item.note}</span>
            </div>
          )}
          {/* 버튼 영역 */}
          <div className="pt-2 flex flex-wrap gap-2 items-center justify-end mt-2">
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

                {item.image_url && (
                  <button
                    onClick={() => handlePrintImage(item.image_url!, item.company, item.program)}
                    className="px-3 py-1 bg-purple-400 text-white rounded hover:bg-purple-500 text-xs"
                  >
                    🖨️ 출력
                  </button>
                )}

                <button
                  onClick={() => handleEdit(item)}
                  className="rounded-lg px-4 py-1 font-semibold shadow bg-blue-100 text-blue-700 hover:bg-blue-200 text-xs transition"
                >
                  수정
                </button>
                <button
                  onClick={() => handleComplete(item.id)}
                  className="rounded-lg px-4 py-1 font-semibold shadow bg-green-100 text-green-700 hover:bg-green-200 text-xs transition"
                >
                  완료
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="rounded-lg px-4 py-1 font-semibold shadow bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs transition"
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
    
  const inProgress = requests.filter(r => !r.is_deleted && !r.completed && r.is_just_upload !== true);
  const filteredInProgress = inProgress.filter((item) =>
    item.company.includes(searchQuery) ||
    item.program.includes(searchQuery) ||
    item.creator?.includes(searchQuery)
  );
  const completed = requests.filter(r => !r.is_deleted && r.completed);
  const deleted = requests.filter(r => r.is_deleted);
  const justUpload = requests.filter(r => r.is_just_upload);

  // 상단 헤더(로고+검색+버튼그룹) 분리
  const renderHeader = (
    <div className="flex items-center justify-between max-w-screen-2xl mx-auto mb-4 gap-4">
      {/* 로고 */}
      <div className="flex items-center gap-2">
        <img src="/logo.png" alt="Vitamin Sign Logo" className="h-12 object-contain cursor-pointer" onClick={() => router.push('/')} />
        {/* 검색창 */}
        <div className="ml-4 flex items-center bg-gray-100 rounded-full px-3 py-1 shadow-inner border border-gray-200 focus-within:ring-2 focus-within:ring-blue-300">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="업체명/프로그램명/작업자 검색"
            className="bg-transparent outline-none px-2 py-1 text-sm w-40 md:w-56"
          />
          <button
            type="button"
            className="ml-1 text-gray-500 hover:text-blue-600 p-1 rounded-full transition"
            onClick={() => {}}
            tabIndex={-1}
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
            </svg>
          </button>
        </div>
      </div>
      {/* 버튼 그룹 */}
      <div className="flex gap-2">
        <button onClick={handlePrintTodayWork} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 text-sm">오늘 작업 출력</button>
        <button onClick={() => setShowForm(!showForm)} className="bg-black text-white px-4 py-2 rounded hover:bg-gray-900 text-sm">{showForm ? '입력 닫기' : editMode ? '수정 중...' : '작업 추가'}</button>
        <button onClick={() => router.push('/completed')} className="bg-gray-200 text-black px-4 py-2 rounded hover:bg-gray-300 text-sm">✅ 완료 보기</button>
        <button onClick={() => router.push('/deleted')} className="bg-gray-200 text-black px-4 py-2 rounded hover:bg-gray-300 text-sm">🗑 삭제 보기</button>
        <button onClick={() => router.push('/justupload')} className="bg-yellow-200 text-yellow-900 px-4 py-2 rounded hover:bg-yellow-300 text-sm font-semibold border border-yellow-400">바쁘니까 일단 올려둠</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white p-4 md:p-6 font-sans text-gray-800">
      {renderHeader}
      {/* 입력 폼: 팝업(모달)로 구현 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onPaste={handlePasteImage}>
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 p-8 w-full max-w-xl relative animate-fadein">
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-3xl font-bold transition"
              onClick={clearForm}
              aria-label="닫기"
            >×</button>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col">
                <label className="font-semibold text-gray-800 mb-1">업체명 *</label>
                <input type="text" value={company} onChange={e => setCompany(e.target.value)} className="rounded-xl border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-400 transition text-base" />
              </div>
              <div className="flex flex-col">
                <label className="font-semibold text-gray-800 mb-1">프로그램명 *</label>
                <input type="text" value={program} onChange={e => setProgram(e.target.value)} className="rounded-xl border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-400 transition text-base" />
              </div>
              <div className="flex flex-col">
                <label className="font-semibold text-gray-800 mb-1">픽업일 *</label>
                <div className="flex gap-2 items-center">
                  <input type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} className="rounded-xl border border-gray-300 px-4 py-2 text-gray-800 focus:ring-2 focus:ring-blue-400 transition text-base" />
                  <button
                    type="button"
                    className="inline-block px-3 py-1 rounded-full bg-blue-500 text-white text-xs font-semibold shadow hover:bg-blue-600 transition"
                    onClick={() => {
                      const now = new Date();
                      const korea = new Date(now.getTime() + 9 * 60 * 60 * 1000);
                      setPickupDate(korea.toISOString().slice(0, 10));
                    }}
                  >오늘</button>
                </div>
              </div>
            </div>
            <div className="flex flex-col mt-6">
              <label className="font-semibold text-gray-800 mb-2">작업자 선택</label>
              <div className="grid grid-cols-2 gap-3">
                {['박혜경', '김한별', '장석환', '정수원'].map((name) => (
                  <button
                    key={name}
                    onClick={() => setCreator(name)}
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
              <textarea value={note} onChange={e => setNote(e.target.value)} className="rounded-xl border border-gray-300 px-4 py-2 focus:ring-2 focus:ring-blue-400 transition text-base" rows={3} />
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
                    >이미지 제거</button>
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
              <button onClick={clearForm} className="bg-gray-100 text-gray-700 px-6 py-2 rounded-xl font-semibold shadow hover:bg-gray-200 transition text-base">취소</button>
              <button onClick={handleSubmit} className="bg-gradient-to-r from-blue-500 to-blue-700 text-white font-bold px-8 py-2 rounded-xl shadow-lg hover:scale-105 transition text-base" disabled={isSubmitting}>
                {isSubmitting ? '처리 중...' : editMode ? '수정' : '등록'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* 고급 이미지 확대 모달 */}
      {modalImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-70 transition-opacity duration-300 animate-fadein"
          onClick={() => { setModalImage(null); setZoom(1); }}
        >
          <div
            className="relative max-w-3xl w-full flex flex-col items-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex gap-2 mb-2">
              <button onClick={() => setZoom(z => Math.max(1, Math.round((z - 0.2) * 10) / 10))} className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-lg font-bold hover:bg-gray-300">-</button>
              <span className="text-white font-semibold text-base">{(zoom * 100).toFixed(0)}%</span>
              <button onClick={() => setZoom(z => Math.min(3, Math.round((z + 0.2) * 10) / 10))} className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-lg font-bold hover:bg-gray-300">+</button>
            </div>
            <img
              src={modalImage}
              style={{ transform: `scale(${zoom})`, transition: 'transform 0.3s' }}
              className="rounded-xl shadow-2xl max-h-[80vh] bg-white"
            />
            <button
              className="absolute top-2 right-2 text-white text-3xl font-bold bg-black bg-opacity-40 rounded-full px-3 py-1 hover:bg-opacity-70 transition"
              onClick={() => { setModalImage(null); setZoom(1); }}
            >×</button>
          </div>
        </div>
      )}
      {/* 카드 리스트 및 나머지 분기 */}
      {only === 'completed' ? (
        <div className="max-w-screen-2xl mx-auto">
          <h2 className="font-semibold text-base text-green-700 mb-2">✅ 완료</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {completed.filter(item =>
              item.company.includes(searchQuery) ||
              item.program.includes(searchQuery) ||
              item.creator?.includes(searchQuery)
            ).map(item => (
              <div key={item.id} className="flex flex-col justify-between rounded-2xl shadow-md overflow-hidden border-2 border-gray-300 bg-white">
                <div className="h-8 bg-gray-200 flex items-center justify-center text-gray-700 text-xs font-bold">완료</div>
                <div className="flex flex-col p-4 space-y-2">
                  <div>
                    <p className="text-lg font-bold truncate">{item.company}</p>
                    <p className="text-sm text-gray-600 truncate">{item.program}</p>
                  </div>
                  {item.image_url && (
                    <img src={item.image_url} className="w-full h-32 object-contain rounded-md border bg-gray-50" />
                  )}
                  <div className="text-xs text-gray-500 mt-2">
                    <div>🕒 업로드: {new Date(item.created_at).toLocaleString('ko-KR')}</div>
                    <div>✅ 완료: {item.updated_at ? new Date(item.updated_at).toLocaleString('ko-KR') : '-'}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : only === 'deleted' ? (
        <div className="max-w-screen-2xl mx-auto">
          <h2 className="font-semibold text-base text-gray-500 mb-2">🗑 삭제됨</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {deleted.map(item => (
              <div key={item.id} className="flex flex-col justify-between rounded-2xl shadow-md overflow-hidden border-2 border-gray-300 bg-white">
                <div className="h-8 bg-gray-200 flex items-center justify-center text-gray-700 text-xs font-bold">삭제됨</div>
                <div className="flex flex-col p-4 space-y-2">
                  <div>
                    <p className="text-lg font-bold truncate">{item.company}</p>
                    <p className="text-sm text-gray-600 truncate">{item.program}</p>
                  </div>
                  {item.image_url && (
                    <img src={item.image_url} className="w-full h-32 object-contain rounded-md border bg-gray-50" />
                  )}
                  <div className="text-xs text-gray-500 mt-2">
                    <div>🕒 업로드: {new Date(item.created_at).toLocaleString('ko-KR')}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : only === 'justupload' ? (
        <div className="max-w-screen-2xl mx-auto">
          <h2 className="font-semibold text-base text-yellow-700 mb-2">📤 바빠서 원고만 올림</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {justUpload.map(item => (
              <div key={item.id} className="flex flex-col justify-between rounded-2xl shadow-md overflow-hidden border-2 border-yellow-400 bg-white">
                <div className="h-8 bg-yellow-200 flex items-center justify-center text-yellow-900 text-xs font-bold">바빠서 원고만 올림</div>
                <div className="flex flex-col p-4 space-y-2">
                  <div>
                    <p className="text-lg font-bold truncate">{item.company}</p>
                    <p className="text-sm text-gray-600 truncate">{item.program}</p>
                  </div>
                  {item.image_url && (
                    <img src={item.image_url} className="w-full h-32 object-contain rounded-md border bg-gray-50" />
                  )}
                  <div className="text-xs text-gray-500 mt-2">
                    <div>🕒 업로드: {new Date(item.created_at).toLocaleString('ko-KR')}</div>
                  </div>
                  <div className="flex gap-2 justify-end items-center mt-2">
                    <button onClick={async () => { await supabase.from('request').update({ is_just_upload: false }).eq('id', item.id); fetchRequests(); }} className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded font-semibold text-xs shadow hover:bg-yellow-300 transition">작업폴더로 이동</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <section className="relative z-10 max-w-screen-2xl mx-auto space-y-10 pb-32">
          <div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {filteredInProgress.map(renderCard)}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
