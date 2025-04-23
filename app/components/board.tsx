'use client';
import { useEffect, useState, ChangeEvent, ClipboardEvent, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
// react-beautiful-dnd 임포트 (타입 포함)
import { DragDropContext, Droppable, Draggable, DropResult, DraggableProvided, DraggableStateSnapshot, DroppableProvided, DroppableStateSnapshot } from 'react-beautiful-dnd';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing. Check your .env.local file or Vercel Environment Variables.');
}
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Interface
interface RequestItem {
  id: number;
  created_at: string;
  updated_at?: string;
  company: string;
  program: string;
  pickup_date: string;
  note: string;
  image_url: string | null;
  completed: boolean;
  is_urgent: boolean;
  is_deleted: boolean;
  deleted_at?: string | null;
}

// 컬럼 ID 정의
const COLUMN_IDS = {
    URGENT: 'urgent',
    REGULAR: 'regular',
    COMPLETED: 'completed',
    DELETED: 'deleted'
};


export default function Board() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  // Form State
  const [company, setCompany] = useState('');
  const [program, setProgram] = useState('');
  const [pickupDate, setPickupDate] = useState('');
  const [note, setNote] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUrgent, setIsUrgent] = useState(false);
  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  // State to track client-side mount
  const [isClient, setIsClient] = useState(false);

  // Set isClient to true only after component mounts
  useEffect(() => {
    setIsClient(true);
  }, []);

  // --- Data Fetching ---
  const fetchRequests = useCallback(async () => {
    if (!supabase) { setError("Supabase 클라이언트가 초기화되지 않았습니다."); setIsLoading(false); return; }
    if(!isLoading) setIsLoading(true);
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('request')
      .select('*')
      .order('is_deleted', { ascending: true })
      .order('is_urgent', { ascending: false })
      .order('created_at', { ascending: false });
    setIsLoading(false);
    if (fetchError) {
      console.error('Error fetching requests:', fetchError);
       if (fetchError.message.includes('column') && fetchError.message.includes('does not exist')) { setError(`데이터 로딩 실패: DB 테이블(${fetchError.message.match(/relation "(\w+)"/)?.[1] || 'request'})에 필요한 컬럼(${fetchError.message.match(/column "(\w+)"/)?.[1] || '???'})이 없습니다.`); }
       else { setError(`데이터 로딩 실패: ${fetchError.message}`); }
      setRequests([]);
    } else { setRequests(data || []); }
  }, [isLoading]); // Include isLoading

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(() => { if (supabase) { fetchRequests(); } }, 15000);
    return () => clearInterval(interval);
  }, [fetchRequests]); // fetchRequests is memoized

  // --- Image Handling ---
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null; setImage(file);
      if (file) { const reader = new FileReader(); reader.onloadend = () => { setImagePreview(reader.result as string); }; reader.readAsDataURL(file); }
      else { setImagePreview(null); }
  };
  const uploadImage = async (file: File): Promise<string | null> => {
     if (!supabase) { setError("Supabase 클라이언트 없음"); return null; }
    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const { data, error: uploadError } = await supabase.storage.from('request-images').upload(fileName, file);
    if (uploadError) { console.error('Error uploading image:', uploadError); setError(`이미지 업로드 실패: ${uploadError.message}`); return null; }
    const { data: urlData } = supabase.storage.from('request-images').getPublicUrl(fileName);
    return urlData?.publicUrl || null;
  };

  // --- Form Submission ---
  const handleSubmit = async () => {
    if (!supabase) { setError("Supabase 클라이언트 없음"); return; }
    if (!company || !program || !pickupDate) { setError('업체명, 프로그램명, 픽업일은 필수 항목입니다.'); return; }
    setIsSubmitting(true); setError(null);
    let imageUrl: string | null = null;
    if (image) {
        imageUrl = await uploadImage(image);
        if (!imageUrl && !error) { setError('이미지 업로드 중 오류가 발생했습니다.'); }
        if (!imageUrl || error) { setIsSubmitting(false); return; }
    }
    const { error: insertError } = await supabase.from('request').insert([{ company, program, pickup_date: pickupDate, note, image_url: imageUrl, completed: false, is_urgent: isUrgent, is_deleted: false }]);
    setIsSubmitting(false);
    if (insertError) { console.error('Error inserting request:', insertError); setError(`등록 실패: ${insertError.message}`); }
    else { clearFormFields(); setShowForm(false); fetchRequests(); }
  };

  const clearFormFields = () => {
      setCompany(''); setProgram(''); setPickupDate(''); setNote('');
      setImage(null); setImagePreview(null); setIsUrgent(false);
  }

  // --- Mark as Complete ---
  const markComplete = async (id: number) => {
     if (!supabase) { setError("Supabase 클라이언트 없음"); return; }
    setError(null);
    const { data, error: updateError } = await supabase
        .from('request')
        .update({ completed: true, updated_at: new Date().toISOString(), is_urgent: false })
        .eq('id', id)
        .select();
    if (updateError) { console.error('Error marking complete:', updateError); setError(`업데이트 실패: ${updateError.message}`); }
    else { fetchRequests(); }
  };

  // --- Handle Delete (Soft Delete) ---
  const handleDelete = async (id: number) => {
     if (!supabase) { setError("Supabase 클라이언트 없음"); return; }
    if (window.confirm('정말로 이 작업을 삭제하시겠습니까? 삭제된 작업은 최근 삭제 목록에서 확인할 수 있습니다.')) {
      setError(null);
      const { error: deleteError } = await supabase.from('request').update({ is_deleted: true, deleted_at: new Date().toISOString() }).eq('id', id);
      if (deleteError) { console.error('Error deleting request:', deleteError); setError(`삭제 실패: ${deleteError.message}`); }
      else { fetchRequests(); }
    }
  };

  // --- Paste Image Handling ---
  const handlePasteImage = useCallback((e: globalThis.ClipboardEvent) => {
    const file = e.clipboardData?.files?.[0];
    if (file && file.type.startsWith('image/')) {
        setImage(file);
        const reader = new FileReader();
        reader.onloadend = () => { setImagePreview(reader.result as string); }
        reader.readAsDataURL(file);
    }
  }, []);
  useEffect(() => {
    if (showForm) {
        window.addEventListener('paste', handlePasteImage);
        return () => window.removeEventListener('paste', handlePasteImage);
    }
  }, [showForm, handlePasteImage]);

  // --- Filtering Data ---
  const nonDeletedRequests = requests.filter(r => !r.is_deleted);
  const urgentActive = nonDeletedRequests.filter(r => !r.completed && r.is_urgent);
  const regularActive = nonDeletedRequests.filter(r => !r.completed && !r.is_urgent);
  const completed = requests.filter(r => r.completed && !r.is_deleted).slice(0, 100);
  const recentlyDeleted = requests.filter(r => r.is_deleted).sort((a, b) => new Date(b.deleted_at || 0).getTime() - new Date(a.deleted_at || 0).getTime()).slice(0, 10);

  // --- Helper Function for Date Formatting ---
  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return '-';
    try { return new Date(dateString).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }); }
    catch (e) { return dateString; }
  };

  // --- Drag End Handler ---
  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination || (source.droppableId === destination.droppableId && source.index === destination.index) || destination.droppableId === COLUMN_IDS.DELETED || source.droppableId === COLUMN_IDS.DELETED || source.droppableId === COLUMN_IDS.COMPLETED) { return; }
    const itemId = parseInt(draggableId, 10);
    let updateData: Partial<RequestItem> = {};
    const now = new Date().toISOString();
    switch (destination.droppableId) {
      case COLUMN_IDS.URGENT: updateData = { is_urgent: true, completed: false }; break;
      case COLUMN_IDS.REGULAR: updateData = { is_urgent: false, completed: false }; break;
      case COLUMN_IDS.COMPLETED: updateData = { is_urgent: false, completed: true, updated_at: now }; break;
      default: return;
    }
    if (!supabase) { setError("Supabase 클라이언트 없음"); return; }
    setError(null);
    const { error: updateError } = await supabase.from('request').update(updateData).eq('id', itemId);
    if (updateError) { console.error('Error updating on drag end:', updateError); setError(`상태 업데이트 실패: ${updateError.message}`); }
    else { fetchRequests(); }
  };


  // --- Card Component ---
  const TaskCard = ({ item, provided, snapshot }: { item: RequestItem; provided: DraggableProvided; snapshot: DraggableStateSnapshot }) => {
    const isActive = !item.completed && !item.is_deleted;
    const isDeleted = item.is_deleted;
    return (
      <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} style={{ ...provided.draggableProps.style }}
        className={`bg-white rounded-lg shadow border ${ isDeleted ? 'border-gray-300' : item.is_urgent && isActive ? 'border-red-500 border-2' : !item.is_urgent && isActive ? 'border-blue-200' : 'border-gray-200 opacity-75' } p-4 flex flex-col justify-between transition-shadow hover:shadow-md min-h-[200px]`}>
        {/* Card Content */}
        <div>
            <div className="flex justify-between items-start mb-2 pb-2 border-b border-gray-100"> <div> <h3 className={`text-base font-semibold ${isDeleted ? 'text-gray-600' : 'text-gray-800'}`}>{item.company}</h3> <p className={`text-sm ${isDeleted ? 'text-gray-500' : 'text-gray-500'}`}>{item.program}</p> </div> {isDeleted ? ( <span className="status-badge-gray">삭제됨</span> ) : item.is_urgent && isActive ? ( <span className="status-badge-red">🚨 긴급</span> ) : !isActive && !isDeleted ? ( <span className="status-badge-gray">완료</span> ) : null } </div>
            <div className="space-y-2 text-sm mb-3"> <p className={isDeleted ? 'text-gray-600' : 'text-gray-600'}><span className="font-medium mr-1">📅 픽업일:</span> {item.pickup_date}</p> {item.note && (<p className={`${isDeleted ? 'text-gray-600' : 'text-gray-600'} bg-yellow-50 p-2 rounded border border-yellow-100 text-xs`}><span className="font-medium mr-1">📝 메모:</span> {item.note}</p>)} {!isActive && !isDeleted && (<p className="text-gray-500 text-xs"><span className="font-medium mr-1">🕒 완료:</span> {formatDate(item.updated_at || item.created_at)}</p>)} {isDeleted && (<p className="text-gray-500 text-xs"><span className="font-medium mr-1">🗑️ 삭제:</span> {formatDate(item.deleted_at)}</p>)} </div>
        </div>
        {/* Card Footer */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100"> {item.image_url ? (<a href={item.image_url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline font-medium">🔗 원고 보기</a>) : (<span className={`text-sm ${isDeleted ? 'text-gray-500' : 'text-gray-500'}`}>{isDeleted ? '- 원고 없음 -' : '- 원고 없음 -'}</span>)} {isActive && ( <div className="flex items-center space-x-2"> <button onClick={() => markComplete(item.id)} className="button-action-green">✅ 완료 처리</button> <button onClick={() => handleDelete(item.id)} className="button-action-red">🗑️ 삭제</button> </div> )} </div>
      </div>
    );
  }

  // --- Render Loading State ---
   if (!isClient) { // Render nothing or a basic placeholder on the server/pre-hydration
       return (<div className="loading-container"><p className="loading-text">로딩 중...</p></div>); // Can be null or a non-interactive skeleton
   }
   // If client-side, but initial data fetch is happening
   if (isLoading && requests.length === 0) {
       return (<div className="loading-container"><p className="loading-text">데이터 로딩 중...</p></div>);
   }

  // --- Render Main Content (Only on Client) ---
  return (
    <DragDropContext onDragEnd={onDragEnd}>
        <div className="main-container">
            {/* Header */}
            <div className="header-container">
                <h1 className="header-title">비타민사인 작업 현황판</h1>
                {supabase && ( <button onClick={() => setShowForm(!showForm)} className="button-toggle-form"> {showForm ? '➖ 입력창 닫기' : '➕ 입력창 열기'} </button> )}
            </div>

            {/* Error Display */}
            {error && ( <div className="error-banner"> <strong className="font-bold">오류 발생: </strong> <span className="block sm:inline">{error}</span> <button onClick={() => setError(null)} className="error-close-button"> {/* Close SVG */} </button> </div> )}

            {/* Input Form */}
            {showForm && ( <div className="form-container"> {/* Inputs */} <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4"> <input placeholder="업체명 *" value={company} onChange={(e) => setCompany(e.target.value)} className="input-style" required /> <input placeholder="프로그램명 *" value={program} onChange={(e) => setProgram(e.target.value)} className="input-style" required /> <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="input-style text-gray-500" required /> </div> <textarea placeholder="메모 (선택 사항)" value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="input-style mb-4" /> {/* File Input */} <div className="file-input-area"> <input type="file" accept="image/*" onChange={handleFileChange} className="file-input-style" /> {imagePreview ? ( <div className="mt-2"><img src={imagePreview} alt="Preview" className="max-h-40 mx-auto rounded" /><button onClick={() => { setImage(null); setImagePreview(null); }} className="button-text-red"> 이미지 제거 </button></div> ) : ( <p className="text-sm text-gray-500 mt-1"> 이미지 파일을 선택하거나, 📋 <kbd className="kbd-style">Ctrl</kbd> + <kbd className="kbd-style">V</kbd> 로 붙여넣으세요. </p> )} </div> {/* Urgent & Submit/Cancel */} <div className="form-actions"> <div className="flex items-center space-x-2 mb-2 md:mb-0"> <input type="checkbox" id="isUrgentCheckbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} className="checkbox-urgent" /> <label htmlFor="isUrgentCheckbox" className="label-urgent"> 🚨 급함 (Urgent) </label> </div> <div className="flex items-center space-x-3"> <button type="button" onClick={() => {setShowForm(false); clearFormFields();}} className="button-cancel"> ✖️ 취소 </button> <button onClick={handleSubmit} disabled={isSubmitting} className={`button-submit ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}> {isSubmitting ? '등록 중...' : '📤 등록'} </button> </div> </div> </div> )}


            {/* Card Sections */}
            {/* Urgent Active Tasks Section */}
            <section className="mb-8">
                 <h2 className="section-title text-red-600"> <span className="mr-2 text-2xl">🔥</span> 긴급 작업 ({urgentActive.length}) </h2>
                 {!isLoading && urgentActive.length === 0 && <div className="empty-state bg-red-50 border-red-200 text-red-700">긴급 작업이 없습니다.</div>}
                 {/* Show loading only if loading AND there are no items yet */}
                 {isLoading && urgentActive.length === 0 && <div className="empty-state">긴급 작업 로딩 중...</div>}
                 {(urgentActive.length > 0) && (
                    <Droppable droppableId={COLUMN_IDS.URGENT}>
                        {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className={`card-grid ${snapshot.isDraggingOver ? 'bg-red-50' : ''}`}>
                                {urgentActive.map((item, index) => (
                                    <Draggable key={item.id} draggableId={item.id.toString()} index={index}>
                                        {(p: DraggableProvided, s: DraggableStateSnapshot) => (<TaskCard item={item} provided={p} snapshot={s} />)}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                 )}
            </section>

            {/* Regular Active Tasks Section */}
            <section className="mb-8">
                <h2 className="section-title text-gray-700"> <span className="mr-2 text-blue-500 text-2xl">🟦</span> 진행 중인 작업 ({regularActive.length}) </h2>
                {!isLoading && regularActive.length === 0 && urgentActive.length === 0 ? ( <div className="empty-state"> 진행 중인 작업이 없습니다. </div> )
                : !isLoading && regularActive.length === 0 && urgentActive.length > 0 ? ( <div className="empty-state bg-blue-50 border-blue-200 text-blue-700"> 일반 진행 작업이 없습니다. (긴급 작업만 있습니다) </div> )
                : isLoading && regularActive.length === 0 ? ( <div className="empty-state">진행 중인 작업 로딩 중...</div> )
                : (
                    <Droppable droppableId={COLUMN_IDS.REGULAR}>
                        {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className={`card-grid ${snapshot.isDraggingOver ? 'bg-blue-50' : ''}`}>
                                {regularActive.map((item, index) => (
                                    <Draggable key={item.id} draggableId={item.id.toString()} index={index}>
                                        {(p: DraggableProvided, s: DraggableStateSnapshot) => (<TaskCard item={item} provided={p} snapshot={s} />)}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                 )}
            </section>

            {/* Completed Tasks Section */}
            <section className="mb-8">
                <h2 className="section-title text-gray-700"> <span className="mr-2 text-green-500 text-2xl">📦</span> 완료된 작업 (최근 {completed.length}개) </h2>
                 {!isLoading && completed.length === 0 ? ( <div className="empty-state"> 완료된 작업이 없습니다. </div> )
                 : isLoading && completed.length === 0 ? ( <div className="empty-state">완료된 작업 로딩 중...</div> )
                 : (
                    <Droppable droppableId={COLUMN_IDS.COMPLETED}>
                         {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className={`card-grid ${snapshot.isDraggingOver ? 'bg-green-50' : ''}`}>
                                {completed.map((item, index) => (
                                    <Draggable key={item.id} draggableId={item.id.toString()} index={index} isDragDisabled={true}>
                                        {(p: DraggableProvided, s: DraggableStateSnapshot) => (<TaskCard item={item} provided={p} snapshot={s} />)}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                  )}
            </section>

            {/* Recently Deleted Section */}
            <section>
                <h2 className="section-title text-gray-500"> <span className="mr-2 text-2xl">🗑️</span> 최근 삭제된 작업 (최대 10개) </h2>
                {!isLoading && recentlyDeleted.length === 0 ? ( <div className="empty-state"> 최근 삭제된 작업이 없습니다. </div> )
                : isLoading && recentlyDeleted.length === 0 ? ( <div className="empty-state">삭제된 작업 로딩 중...</div> )
                : (
                    <div className="card-grid">
                        {recentlyDeleted.map((item, index) => (
                            <Draggable key={item.id} draggableId={item.id.toString()} index={index} isDragDisabled={true}>
                                {(p: DraggableProvided, s: DraggableStateSnapshot) => (<TaskCard item={item} provided={p} snapshot={s} />)}
                            </Draggable>
                        ))}
                    </div>
                 )}
            </section>

             {/* Reusable styles */}
             <style jsx>{`
                /* Style definitions remain the same as previous version */
                .main-container { @apply min-h-screen bg-gradient-to-br from-blue-50 via-gray-50 to-indigo-50 p-4 md:p-6 font-sans text-gray-800; }
                .loading-container { @apply min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-gray-50 to-indigo-50; }
                .loading-text { @apply text-xl text-gray-500 animate-pulse; }
                /* ... other styles ... */
                .card-grid { @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4; }
                /* ... button/badge styles etc ... */
            `}</style>
        </div>
    </DragDropContext>
  );
}