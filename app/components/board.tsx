'use client';
import { useEffect, useState, ChangeEvent, ClipboardEvent, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

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
  const [isClient, setIsClient] = useState(false); // Keep for potential future use or hydration safety

  useEffect(() => { setIsClient(true); }, []);

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
  }, [isLoading]);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(() => { if (supabase) { fetchRequests(); } }, 15000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  // --- Image Handling ---
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0] || null;
      setImage(file);
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => { setImagePreview(reader.result as string); };
          reader.readAsDataURL(file);
      } else { setImagePreview(null); }
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


  // --- Redesigned Task Card Component (WITHOUT DND props) ---
  const TaskCard = ({ item }: { item: RequestItem }) => {
    const isActive = !item.completed && !item.is_deleted;
    const isDeleted = item.is_deleted;

    return (
      // Removed DND related props from this div
      <div
        className={`task-card-container border ${
          isDeleted ? 'border-gray-300 bg-gray-50'
          : item.is_urgent && isActive ? 'border-red-400 border-2 bg-white'
          : !item.is_urgent && isActive ? 'border-blue-200 bg-white'
          : 'border-gray-200 bg-gray-50 opacity-80' // Completed style
        }`}
      >
        {/* Image Thumbnail */}
        {item.image_url && !isDeleted && (
          <a href={item.image_url} target="_blank" rel="noopener noreferrer" className="card-image-link group">
            <img src={item.image_url} alt={`${item.company} - ${item.program} 원고`} className="card-image" loading="lazy" />
          </a>
        )}
        {/* Content Area */}
        <div className={`card-content-area ${item.image_url && !isDeleted ? '' : 'pt-3'}`}>
          {/* Header */}
          <div className="card-header">
            <div>
              <h3 className={`card-title ${isDeleted ? 'text-gray-500' : 'text-gray-800'}`}>{item.company}</h3>
              <p className={`card-subtitle ${isDeleted ? 'text-gray-400' : 'text-gray-500'}`}>{item.program}</p>
            </div>
            <div className="card-status-badge">
                {isDeleted ? ( <span className="status-badge-gray">삭제됨</span> )
                : item.is_urgent && isActive ? ( <span className="status-badge-red">🚨 긴급</span> )
                : !isActive && !isDeleted ? ( <span className="status-badge-gray">완료</span> ) : null }
            </div>
          </div>
          {/* Details */}
          <div className="card-details">
            <div className="detail-item"> <span className="detail-icon">📅</span> <span className="detail-label">픽업일:</span> <span>{item.pickup_date}</span> </div>
            {!isActive && !isDeleted && ( <div className="detail-item"> <span className="detail-icon">🕒</span> <span className="detail-label">완료:</span> <span>{formatDate(item.updated_at || item.created_at)}</span> </div> )}
            {isDeleted && ( <div className="detail-item"> <span className="detail-icon">🗑️</span> <span className="detail-label">삭제:</span> <span>{formatDate(item.deleted_at)}</span> </div> )}
          </div>
          {/* Note */}
          {item.note && ( <div className="card-note"> <p className="font-medium mb-1">📝 메모:</p> <p className="whitespace-pre-wrap break-words">{item.note}</p> </div> )}
          {/* Footer */}
          <div className="card-footer">
             {item.image_url ? ( <a href={item.image_url} target="_blank" rel="noopener noreferrer" className={`text-xs font-medium hover:underline ${isDeleted ? 'text-gray-500 pointer-events-none' : 'text-indigo-600 hover:text-indigo-800'}`}>🔗 원고 보기</a> )
             : (<span className={`text-xs ${isDeleted ? 'text-gray-400' : 'text-gray-500'}`}>{isDeleted ? '- 원고 정보 없음 -' : '- 원고 없음 -'}</span>)}
             {isActive && ( <div className="flex items-center space-x-2"> <button onClick={() => markComplete(item.id)} className="button-action-green">✅ 완료</button> <button onClick={() => handleDelete(item.id)} className="button-action-red">🗑️ 삭제</button> </div> )}
          </div>
        </div>
      </div>
    );
  }

  // --- Render Loading State ---
   if (!isClient || (isLoading && requests.length === 0)) { return (<div className="loading-container"><p className="loading-text">로딩 중...</p></div>); }

  // --- Render Main Content (WITHOUT DND Wrappers) ---
  return (
    // Removed DragDropContext
    <div className="main-container">
        {/* Header */}
        <div className="header-container">
            <h1 className="header-title">비타민사인 작업 현황판</h1>
            {supabase && ( <button onClick={() => setShowForm(!showForm)} className="button-toggle-form"> {showForm ? '➖ 입력창 닫기' : '➕ 입력창 열기'} </button> )}
        </div>

        {/* Error Display */}
        {error && ( <div className="error-banner"> <strong className="font-bold">오류 발생: </strong> <span className="block sm:inline">{error}</span> <button onClick={() => setError(null)} className="error-close-button"> <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg> </button> </div> )}

        {/* Input Form */}
        {showForm && ( <div className="form-container"> {/* Inputs */} <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4"> <input placeholder="업체명 *" value={company} onChange={(e) => setCompany(e.target.value)} className="input-style" required /> <input placeholder="프로그램명 *" value={program} onChange={(e) => setProgram(e.target.value)} className="input-style" required /> <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="input-style text-gray-500" required /> </div> <textarea placeholder="메모 (선택 사항)" value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="input-style mb-4" /> {/* File Input */} <div className="file-input-area"> <input type="file" accept="image/*" onChange={handleFileChange} className="file-input-style" /> {imagePreview ? ( <div className="mt-2"><img src={imagePreview} alt="Preview" className="max-h-40 mx-auto rounded" /><button onClick={() => { setImage(null); setImagePreview(null); }} className="button-text-red"> 이미지 제거 </button></div> ) : ( <p className="text-sm text-gray-500 mt-1"> 이미지 파일을 선택하거나, 📋 <kbd className="kbd-style">Ctrl</kbd> + <kbd className="kbd-style">V</kbd> 로 붙여넣으세요. </p> )} </div> {/* Urgent & Submit/Cancel */} <div className="form-actions"> <div className="flex items-center space-x-2 mb-2 md:mb-0"> <input type="checkbox" id="isUrgentCheckbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} className="checkbox-urgent" /> <label htmlFor="isUrgentCheckbox" className="label-urgent"> 🚨 급함 (Urgent) </label> </div> <div className="flex items-center space-x-3"> <button type="button" onClick={() => {setShowForm(false); clearFormFields();}} className="button-cancel"> ✖️ 취소 </button> <button onClick={handleSubmit} disabled={isSubmitting} className={`button-submit ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}> {isSubmitting ? '등록 중...' : '📤 등록'} </button> </div> </div> </div> )}


        {/* Card Sections */}
        {/* Urgent Active Tasks Section */}
        <section className="mb-8">
             <h2 className="section-title text-red-600"> <span className="mr-2 text-2xl">🔥</span> 긴급 작업 ({urgentActive.length}) </h2>
             {!isLoading && urgentActive.length === 0 && <div className="empty-state-section bg-red-50 border-red-200 text-red-700">긴급 작업이 없습니다.</div>}
             {isLoading && urgentActive.length === 0 && <div className="empty-state-section">긴급 작업 로딩 중...</div>}
             {(urgentActive.length > 0) && (
                // Removed Droppable
                <div className="card-grid">
                    {urgentActive.map((item) => (
                        // Removed Draggable
                        <TaskCard key={item.id} item={item} />
                    ))}
                </div>
             )}
        </section>

        {/* Regular Active Tasks Section */}
        <section className="mb-8">
            <h2 className="section-title text-gray-700"> <span className="mr-2 text-blue-500 text-2xl">🟦</span> 진행 중인 작업 ({regularActive.length}) </h2>
            {!isLoading && regularActive.length === 0 && urgentActive.length === 0 ? ( <div className="empty-state-section"> 진행 중인 작업이 없습니다. </div> )
            : !isLoading && regularActive.length === 0 && urgentActive.length > 0 ? ( <div className="empty-state-section bg-blue-50 border-blue-200 text-blue-700"> 일반 진행 작업이 없습니다. </div> )
            : isLoading && regularActive.length === 0 ? ( <div className="empty-state-section">진행 중인 작업 로딩 중...</div> )
            : (
                // Removed Droppable
                <div className="card-grid">
                    {regularActive.map((item) => (
                         // Removed Draggable
                        <TaskCard key={item.id} item={item} />
                    ))}
                </div>
             )}
        </section>

        {/* Completed Tasks Section */}
        <section className="mb-8">
            <h2 className="section-title text-gray-700"> <span className="mr-2 text-green-500 text-2xl">📦</span> 완료된 작업 ({completed.length}개) </h2>
             {!isLoading && completed.length === 0 ? ( <div className="empty-state-section"> 완료된 작업이 없습니다. </div> )
             : isLoading && completed.length === 0 ? ( <div className="empty-state-section">완료된 작업 로딩 중...</div> )
             : (
                // Removed Droppable
                <div className="card-grid">
                    {completed.map((item) => (
                         // Removed Draggable
                        <TaskCard key={item.id} item={item} />
                    ))}
                </div>
              )}
        </section>

        {/* Recently Deleted Section */}
        <section>
            <h2 className="section-title text-gray-500"> <span className="mr-2 text-2xl">🗑️</span> 최근 삭제된 작업 ({recentlyDeleted.length}개) </h2>
            {!isLoading && recentlyDeleted.length === 0 ? ( <div className="empty-state-section"> 최근 삭제된 작업이 없습니다. </div> )
            : isLoading && recentlyDeleted.length === 0 ? ( <div className="empty-state-section">삭제된 작업 로딩 중...</div> )
            : (
                // Removed Droppable
                <div className="card-grid">
                    {recentlyDeleted.map((item) => (
                       // Removed Draggable
                       <TaskCard key={item.id} item={item} />
                    ))}
                </div>
             )}
        </section>

         {/* Reusable styles */}
         <style jsx>{`
            /* Base container and layout */
            .main-container { @apply min-h-screen bg-gradient-to-br from-blue-50 via-gray-50 to-indigo-50 p-4 md:p-6 font-sans text-gray-800; }
            .loading-container { @apply min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-gray-50 to-indigo-50; }
            .loading-text { @apply text-xl text-gray-500 animate-pulse; }
            .header-container { @apply flex flex-wrap justify-between items-center mb-6 pb-4 border-b border-gray-200; }
            .header-title { @apply text-2xl md:text-3xl font-bold text-indigo-800; }
            .button-toggle-form { @apply mt-2 md:mt-0 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-5 rounded-lg shadow-sm transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500; }

            /* Error banner */
            .error-banner { @apply bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4; }
            .error-close-button { @apply absolute top-0 bottom-0 right-0 px-4 py-3; }

            /* Form styles */
            .form-container { @apply bg-white p-5 mb-6 rounded-lg shadow-md border border-gray-200 transition-all duration-300 ease-out; }
            .input-style { @apply block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm; }
            .file-input-area { @apply border border-dashed border-gray-300 p-4 rounded-md text-center mb-4; }
            .file-input-style { @apply block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 mb-2 cursor-pointer; }
            .button-text-red { @apply mt-1 text-xs text-red-500 hover:text-red-700; }
            .kbd-style { @apply px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg; }
            .form-actions { @apply flex flex-wrap justify-between items-center mt-4; }
            .checkbox-urgent { @apply h-5 w-5 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer; }
            .label-urgent { @apply text-sm font-medium text-red-600 cursor-pointer; }
            .button-cancel { @apply bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-5 rounded-lg shadow-sm transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400; }
            .button-submit { @apply bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-5 rounded-lg shadow-sm transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500; }

            /* Section and Card styles */
            .section-title { @apply text-xl font-semibold mb-4 flex items-center; }
            .card-grid { @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4; }
            .task-card-container { @apply rounded-lg overflow-hidden flex flex-col justify-between transition-shadow duration-200 ease-in-out hover:shadow-lg; }
            .card-image-link { @apply block aspect-video overflow-hidden rounded-t-lg mb-3 group; }
            .card-image { @apply w-full h-full object-cover transition-transform duration-300 group-hover:scale-105; }
            .card-content-area { @apply p-3 flex flex-col flex-grow; }
            .card-header { @apply flex justify-between items-start mb-2; }
            .card-title { @apply font-semibold text-base; }
            .card-subtitle { @apply text-sm; }
            .card-status-badge { @apply flex-shrink-0 ml-2; }
            .card-details { @apply text-xs text-gray-500 space-y-1 mb-3; }
            .detail-item { @apply flex items-center; }
            .detail-icon { @apply mr-1; }
            .detail-label { @apply font-medium mr-1; }
            .card-note { @apply mb-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800; }
            .card-footer { @apply mt-auto pt-3 border-t border-gray-100 flex justify-between items-center; }
            .empty-state-section { @apply bg-white rounded-lg shadow border border-gray-200 p-10 text-center text-gray-500; }

            /* Status Badges */
            .status-badge-gray { @apply inline-block bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap; }
            .status-badge-red { @apply inline-block bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap; }

            /* Action Buttons in Card */
            .button-action-green { @apply bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium hover:bg-green-200 transition duration-150 whitespace-nowrap; }
            .button-action-red { @apply bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-medium hover:bg-red-200 transition duration-150 whitespace-nowrap; }
        `}</style>
    </div>
    // Removed closing </DragDropContext>
  );
}