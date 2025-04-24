'use client';
import { useEffect, useState, useCallback, ChangeEvent, ClipboardEvent, FormEvent } from 'react'; // FormEvent 추가
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
  const [modalImage, setModalImage] = useState<string | null>(null);

  // --- 초기 로직 복원: 데이터 로딩 및 자동 삭제(Capping) ---
  const fetchRequests = useCallback(async () => {
    setError(null); // 에러 초기화
    const { data, error: fetchError } = await supabase
      .from('request')
      .select('*')
      // 데이터를 먼저 가져온 후 클라이언트에서 정렬 및 필터링
      .order('created_at', { ascending: false }); // 기본 정렬: 최신순

    if (fetchError) {
      setError(`데이터 로딩 실패: ${fetchError.message}`);
      setRequests([]); // 오류 시 빈 배열로 설정
      return;
    }

    let currentData = data || [];

    // --- 자동 삭제 (Capping) 로직 시작 ---
    // 완료된 항목 필터링 및 정렬 (오래된 순 -> 최신 100개 제외하고 삭제 위함)
    const completedForCap = currentData.filter(r => r.completed && !r.is_deleted)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    // 삭제된 항목 필터링 및 정렬 (오래된 순)
    const deletedForCap = currentData.filter(r => r.is_deleted)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    // 삭제할 대상 선정 (완료된 것 중 100개 넘는 가장 오래된 것들)
    const completedToDelete = completedForCap.length > 100
        ? completedForCap.slice(0, completedForCap.length - 100)
        : [];
    // 삭제할 대상 선정 (삭제된 것 중 10개 넘는 가장 오래된 것들)
    const deletedToDelete = deletedForCap.length > 10
        ? deletedForCap.slice(0, deletedForCap.length - 10)
        : [];

    const idsToDelete = new Set([...completedToDelete.map(r => r.id), ...deletedToDelete.map(r => r.id)]);

    if (idsToDelete.size > 0) {
        console.log(`[Auto Capping] Deleting ${idsToDelete.size} old records...`);
        try {
            await Promise.all(
                Array.from(idsToDelete).map(id =>
                    supabase.from('request').delete().eq('id', id)
                )
            );
            // 삭제 성공 시, 현재 데이터에서 해당 항목들 제거
            currentData = currentData.filter(r => !idsToDelete.has(r.id));
            console.log(`[Auto Capping] Deletion successful.`);
        } catch (deleteError: any) {
            console.error("Error during auto capping deletion:", deleteError);
            setError(`데이터 자동 정리 중 오류 발생: ${deleteError.message}`);
            // 삭제 실패 시에도 일단 로드된 데이터는 보여줌 (오류 메시지와 함께)
        }
    }
    // --- 자동 삭제 (Capping) 로직 끝 ---

    // 최종적으로 상태 업데이트 (최신순 정렬된 데이터)
    // Capping 로직 후 데이터가 변경되었을 수 있으므로 다시 최신순 정렬
    currentData.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    setRequests(currentData);

  }, []); // useCallback dependency 비움

  // --- 초기 로직 복원: Polling 방식 데이터 갱신 ---
  useEffect(() => {
    fetchRequests(); // 초기 로딩
    const interval = setInterval(fetchRequests, 15000); // 15초마다 갱신
    return () => clearInterval(interval); // 언마운트 시 인터벌 정리
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
    e.target.value = ''; // 같은 파일 다시 선택 가능하도록 초기화
  };

  const handlePasteImage = useCallback((e: ClipboardEvent) => {
    const file = e.clipboardData.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
      const fileInput = document.getElementById('image-upload') as HTMLInputElement | null;
      if(fileInput) fileInput.value = '';
    }
  }, []);

  // --- 초기 로직 복원: paste 리스너에 'as any' 사용 ---
  useEffect(() => {
    if (showForm) {
      // 'as any'는 타입 오류를 발생시킬 수 있으니 주의하세요.
      // 'as EventListener' 사용을 고려해보는 것이 좋습니다.
      window.addEventListener('paste', handlePasteImage as any);
      return () => window.removeEventListener('paste', handlePasteImage as any);
    }
  }, [showForm, handlePasteImage]);

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`; // 파일 이름 정제
    const { error } = await supabase.storage.from('request-images').upload(fileName, file);
    if (error) {
      setError(`이미지 업로드 실패: ${error.message}`);
      console.error("Image upload error:", error);
      return null;
    }
    const { data } = supabase.storage.from('request-images').getPublicUrl(fileName);
    return data?.publicUrl ?? null;
  };

  const handleSubmit = async (event?: FormEvent) => { // event 파라미터 추가 및 타입 지정
    if (event) event.preventDefault(); // form 제출 시 페이지 새로고침 방지
    if (!company || !program || !pickupDate) {
      setError('업체명, 프로그램명, 픽업일은 필수입니다.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    let imageUrl = imagePreview;

    if (image) { // 새 이미지 파일이 선택된 경우
      const uploaded = await uploadImage(image);
      if (!uploaded) {
        setIsSubmitting(false);
        return; // 업로드 실패 시 중단
      }
      imageUrl = uploaded;
    } else if (editMode && !imagePreview) {
      // 수정 모드에서 이미지 미리보기가 없는 경우 (이미지 제거)
      imageUrl = null;
    }

    try {
        if (editMode && editingId !== null) { // 수정 모드
            const { error: updateError } = await supabase.from('request').update({
                company, program, pickup_date: pickupDate, note,
                image_url: imageUrl, is_urgent: isUrgent
            }).eq('id', editingId);
            if (updateError) throw updateError;
            console.log("Request updated successfully:", editingId);
        } else { // 등록 모드
            const { error: insertError } = await supabase.from('request').insert([{
                company, program, pickup_date: pickupDate, note,
                image_url: imageUrl, is_urgent: isUrgent, completed: false, is_deleted: false
            }]);
            if (insertError) throw insertError;
            console.log("Request inserted successfully");
        }
        clearForm(); // 성공 시 폼 초기화
        fetchRequests(); // 데이터 다시 로드
    } catch (err: any) {
        setError(`${editMode ? '수정' : '등록'} 실패: ${err.message}`);
        console.error("Submit error:", err);
    } finally {
        setIsSubmitting(false);
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
    setEditMode(false);
    setEditingId(null);
    setError(null); // 폼 닫을 때 에러 메시지 초기화
    const fileInput = document.getElementById('image-upload') as HTMLInputElement | null;
    if(fileInput) fileInput.value = '';
  };

  const handleEdit = (item: RequestItem) => {
    setCompany(item.company);
    setProgram(item.program);
    setPickupDate(item.pickup_date);
    setNote(item.note ?? ''); // null일 경우 빈 문자열로
    setImage(null); // 새 파일 선택 초기화
    setImagePreview(item.image_url ?? null);
    setIsUrgent(item.is_urgent);
    setEditingId(item.id);
    setEditMode(true);
    setShowForm(true);
    setError(null);
  };

  const handleComplete = async (id: number) => {
    setError(null);
    try {
        await supabase.from('request').update({ completed: true, is_urgent: false }).eq('id', id);
        fetchRequests(); // 완료 후 데이터 갱신
    } catch (err: any) {
        setError(`완료 처리 실패: ${err.message}`);
        console.error("Complete error:", err);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('정말 삭제하시겠습니까? (휴지통으로 이동됩니다)')) return;
    setError(null);
    try {
        await supabase.from('request').update({ is_deleted: true }).eq('id', id);
        fetchRequests(); // 삭제 후 데이터 갱신
    } catch (err: any) {
        setError(`삭제 처리 실패: ${err.message}`);
        console.error("Delete error:", err);
    }
  };

  // --- 초기 카드 렌더링 로직 복원 ---
  const renderCard = (item: RequestItem) => {
    const isActive = !item.completed && !item.is_deleted;
    return (
      <div key={item.id} className={`p-6 bg-white rounded-xl shadow-md border ${isActive && item.is_urgent ? 'border-pink-400 shadow-pink-100' : 'border-gray-200'} flex flex-col justify-between text-sm h-[420px] min-w-[250px] max-w-xs break-words hover:shadow-lg transition-shadow`}>
        <div className="mb-4 space-y-2 overflow-hidden text-ellipsis flex-grow">
          {isActive && item.is_urgent && <span className="text-xs font-semibold text-pink-600 bg-pink-100 px-2 py-0.5 rounded-full inline-block mb-2">긴급</span>}
          <p className="truncate font-medium" title={item.company}>업체명: <span className="font-normal break-all">{item.company}</span></p>
          <p className="truncate font-medium" title={item.program}>프로그램명: <span className="font-normal break-all">{item.program}</span></p>
          <p className="truncate text-gray-700">픽업일: <span className="font-medium">📅 {item.pickup_date}</span></p>
          {item.note && (
            <div className="mt-2 max-h-20 overflow-y-auto bg-gray-50 p-2 rounded text-xs border border-gray-200">
              <p className="whitespace-pre-wrap break-words">{item.note}</p>
            </div>
          )}
        </div>
        {/* 이미지 영역 */}
        {item.image_url && (
          <div className="my-2 flex justify-center max-h-32">
            <img
              src={item.image_url}
              alt={`${item.program} 이미지`} // alt 속성 추가
              onClick={() => setModalImage(item.image_url!)}
              className="cursor-pointer object-contain border rounded max-w-full max-h-full"
              loading="lazy"
            />
          </div>
        )}
        {/* 버튼 및 상태 영역 */}
        <div className="pt-2 flex flex-wrap gap-2 justify-end border-t border-gray-100 mt-auto items-center">
          {isActive && (
            <>
              <button onClick={() => handleEdit(item)} className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-xs transition-colors">수정</button>
              <button onClick={() => handleComplete(item.id)} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs transition-colors">완료</button>
              <button onClick={() => handleDelete(item.id)} className="px-3 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-xs transition-colors">삭제</button>
            </>
          )}
          {item.completed && !item.is_deleted && <span className="text-green-600 text-xs font-medium">✅ 완료됨</span>}
          {item.is_deleted && <span className="text-gray-500 text-xs font-medium">🗑️ 삭제됨</span>}
          <span className="text-gray-400 text-[10px] ml-auto">{new Date(item.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    );
  };

  // 필터링 로직은 변경 없음
  const inProgress = requests.filter(r => !r.is_deleted && !r.completed);
  const completed = requests.filter(r => !r.is_deleted && r.completed);
  const deleted = requests.filter(r => r.is_deleted);

  return (
    // --- font-dohyeon 클래스 적용 ---
    <div className="relative bg-gradient-to-b from-white via-slate-50 to-gray-100 min-h-screen text-gray-900 px-4 py-8 font-dohyeon">
      {/* --- 벚꽃 애니메이션 제거됨 --- */}

      {/* 이미지 확대 모달 */}
      {modalImage && (
        <div className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-80 flex items-center justify-center z-50 p-4" onClick={() => setModalImage(null)}>
          {/* 이미지 클릭 시 모달 닫힘 방지, alt 속성 추가 */}
          <img src={modalImage} alt="확대된 이미지" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setModalImage(null)} className="absolute top-4 right-4 text-white text-3xl font-bold hover:text-gray-300" aria-label="Close modal">&times;</button>
        </div>
      )}

      {/* 로고 */}
      <div className="relative z-10 flex justify-center mb-6">
        <img src="/logo.png" alt="Vitamin Sign Logo" className="h-16 object-contain" />
      </div>

      {/* 에러 메시지 표시 */}
      {error && (
         <div className="relative z-20 max-w-screen-2xl mx-auto bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-sm" role="alert">
           <strong className="font-bold">오류: </strong>
           <span className="block sm:inline">{error}</span>
           <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3">
             <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>닫기</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
           </button>
         </div>
       )}

      {/* 상단 버튼 */}
      <div className="relative z-10 flex flex-wrap justify-end max-w-screen-2xl mx-auto mb-4 gap-2">
        <button onClick={() => { setShowForm(!showForm); if (showForm) clearForm(); else setError(null); }} className={`bg-black text-white px-4 py-2 rounded hover:bg-gray-900 text-sm transition-colors ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}>
          {showForm ? '입력 닫기' : editMode ? '수정 중...' : '✨ 작업 추가'}
        </button>
        <button onClick={() => setShowCompleted(!showCompleted)} className={`${showCompleted ? 'bg-green-200' : 'bg-gray-200'} text-black px-4 py-2 rounded hover:bg-gray-300 text-sm transition-colors`}>
          {showCompleted ? '완료 숨기기' : '✅ 완료 보기'}
        </button>
        <button onClick={() => setShowDeleted(!showDeleted)} className={`${showDeleted ? 'bg-orange-100' : 'bg-gray-200'} text-black px-4 py-2 rounded hover:bg-gray-300 text-sm transition-colors`}>
          {showDeleted ? '삭제 숨기기' : '🗑️ 삭제 보기'}
        </button>
      </div>

      {/* 입력 폼 (이전 버전의 JSX 유지) */}
      {showForm && (
        <div className="relative z-10 max-w-screen-2xl mx-auto bg-white border p-6 rounded-xl shadow mb-8 space-y-5">
          <form onSubmit={handleSubmit} className="space-y-4"> {/* form 태그 추가 */}
              <h3 className="text-lg font-semibold mb-2">{editMode ? '작업 수정' : '새 작업 추가'}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="flex flex-col">
                      <label htmlFor="company" className="font-medium text-gray-800 mb-1 text-sm">업체명 <span className="text-red-500">*</span></label>
                      <input id="company" type="text" value={company} onChange={e => setCompany(e.target.value)} required className="border rounded px-3 py-2 text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500"/>
                  </div>
                  <div className="flex flex-col">
                      <label htmlFor="program" className="font-medium text-gray-800 mb-1 text-sm">프로그램명 <span className="text-red-500">*</span></label>
                      <input id="program" type="text" value={program} onChange={e => setProgram(e.target.value)} required className="border rounded px-3 py-2 text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500"/>
                  </div>
                  <div className="flex flex-col">
                      <label htmlFor="pickupDate" className="font-medium text-gray-800 mb-1 text-sm">픽업일 <span className="text-red-500">*</span></label>
                      <input id="pickupDate" type="date" value={pickupDate} onChange={e => setPickupDate(e.target.value)} required className="border rounded px-3 py-2 text-gray-800 text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500"/>
                  </div>
              </div>

              <div className="flex flex-col">
                  <label htmlFor="note" className="font-medium text-gray-800 mb-1 text-sm">메모</label>
                  <textarea id="note" value={note} onChange={e => setNote(e.target.value)} className="border rounded px-3 py-2 text-sm shadow-sm focus:ring-indigo-500 focus:border-indigo-500" rows={3} />
              </div>

              <div className="flex flex-col">
                  <label htmlFor="image-upload" className="font-medium text-gray-800 mb-1 text-sm">원고 이미지</label>
                  <input id="image-upload" type="file" onChange={handleFileChange} accept="image/*" className="mb-2 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
                  {imagePreview && (
                    <div className="relative mt-2 border rounded p-2 inline-block">
                      <img src={imagePreview} alt="선택된 이미지 미리보기" className="max-h-52 object-contain " />
                      <button
                         type="button"
                         onClick={() => { setImage(null); setImagePreview(null); const fileInput = document.getElementById('image-upload') as HTMLInputElement | null; if(fileInput) fileInput.value = ''; }}
                         className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs font-bold"
                         aria-label="이미지 제거"
                       >
                         &times;
                       </button>
                    </div>
                  )}
              </div>

              <div className="flex items-center space-x-2">
                  <input id="isUrgent" type="checkbox" checked={isUrgent} onChange={e => setIsUrgent(e.target.checked)} className="h-4 w-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"/>
                  <label htmlFor="isUrgent" className="text-sm text-pink-500 font-medium">🌸 급함</label>
              </div>

              <div className="flex justify-end space-x-4 pt-4 border-t mt-4">
                  <button type="button" onClick={clearForm} className="bg-gray-200 px-5 py-2 rounded-md text-sm hover:bg-gray-300 transition-colors">취소</button>
                  <button type="submit" className="bg-black text-white px-5 py-2 rounded-md text-sm hover:bg-gray-800 transition-colors disabled:opacity-50" disabled={isSubmitting}>
                      {isSubmitting ? '처리 중...' : editMode ? '수정' : '등록'}
                  </button>
              </div>
          </form>
        </div>
      )}

      {/* 카드 리스트 */}
      <section className="relative z-10 max-w-screen-2xl mx-auto space-y-10 pb-32">
        <div>
          <h2 className="font-semibold text-lg text-gray-800 mb-3 text-center md:text-left">📂 진행 중 ({inProgress.length})</h2>
          {inProgress.length === 0 ? (
              <p className="text-center text-gray-500 py-8">진행 중인 작업이 없습니다.</p>
          ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                  {inProgress.map(renderCard)}
              </div>
          )}
        </div>

        {showCompleted && (
          <div>
            <h2 className="font-semibold text-lg text-green-700 mb-3 text-center md:text-left">✅ 완료 ({completed.length})</h2>
            {completed.length === 0 ? (
                <p className="text-center text-gray-500 py-8">완료된 작업이 없습니다.</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                    {completed.map(renderCard)}
                </div>
            )}
          </div>
        )}

        {showDeleted && (
          <div>
            <h2 className="font-semibold text-lg text-gray-500 mb-3 text-center md:text-left">🗑 삭제됨 ({deleted.length})</h2>
            {deleted.length === 0 ? (
                <p className="text-center text-gray-500 py-8">삭제된 작업이 없습니다.</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                    {deleted.map(renderCard)}
                </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}