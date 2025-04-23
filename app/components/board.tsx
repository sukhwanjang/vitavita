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

// 드롭 가능한 영역(컬럼)의 ID 정의
const COLUMN_IDS = {
    URGENT: 'urgent',
    REGULAR: 'regular',
    COMPLETED: 'completed',
    DELETED: 'deleted' // 이 ID를 가진 Droppable은 만들지 않음
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

  // --- Data Fetching ---
  const fetchRequests = useCallback(async () => {
    if (!supabase) { setError("Supabase 클라이언트가 초기화되지 않았습니다."); setIsLoading(false); return; }
    if(!isLoading) setIsLoading(true); // Prevent flicker if already loading
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
       if (fetchError.message.includes('column') && fetchError.message.includes('does not exist')) { setError(`데이터 로딩 실패: DB 테이블에 필요한 컬럼(${fetchError.message.match(/column "(\w+)"/)?.[1] || '???'})이 없습니다.`); }
       else { setError(`데이터 로딩 실패: ${fetchError.message}`); }
      setRequests([]);
    } else { setRequests(data || []); }
  }, [isLoading]); // Include isLoading

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(() => { if (supabase) { fetchRequests(); } }, 15000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  // --- Image Handling ---
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => { /* ... */ }; // No change
  const uploadImage = async (file: File): Promise<string | null> => { /* ... */ return null; }; // No change

  // --- Form Submission ---
  const handleSubmit = async () => { /* ... */ }; // No change
  const clearFormFields = () => { /* ... */ }; // No change

  // --- Mark as Complete ---
  const markComplete = async (id: number) => { /* ... */ }; // No change

  // --- Handle Delete (Soft Delete) ---
  const handleDelete = async (id: number) => { /* ... */ }; // No change

  // --- Paste Image Handling ---
  const handlePasteImage = useCallback((e: globalThis.ClipboardEvent) => { /* ... */ }, []); // No change
  useEffect(() => { /* ... */ }, [showForm, handlePasteImage]); // No change

  // --- Filtering Data ---
  const nonDeletedRequests = requests.filter(r => !r.is_deleted);
  const urgentActive = nonDeletedRequests.filter(r => !r.completed && r.is_urgent);
  const regularActive = nonDeletedRequests.filter(r => !r.completed && !r.is_urgent);
  const completed = requests.filter(r => r.completed && !r.is_deleted).slice(0, 100);
  const recentlyDeleted = requests.filter(r => r.is_deleted).sort((a, b) => new Date(b.deleted_at || 0).getTime() - new Date(a.deleted_at || 0).getTime()).slice(0, 10);

  // --- Helper Function for Date Formatting ---
  const formatDate = (dateString: string | undefined | null) => { /* ... */ return ''; }; // No change

  // --- Drag End Handler ---
  const onDragEnd = async (result: DropResult) => { /* ... */ }; // No change needed here from previous version

  // --- Card Component ---
  // Added explicit types for provided and snapshot
  const TaskCard = ({ item, provided, snapshot }: { item: RequestItem; provided: DraggableProvided; snapshot: DraggableStateSnapshot }) => {
    const isActive = !item.completed && !item.is_deleted;
    const isDeleted = item.is_deleted;

    return (
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
        style={{
            ...provided.draggableProps.style,
            // isDragging 스타일링 (선택 사항)
            // boxShadow: snapshot.isDragging ? '0 2px 5px rgba(0,0,0,0.2)' : 'none',
            // zIndex: snapshot.isDragging ? 10 : 1,
        }}
        className={`bg-white rounded-lg shadow border ${
          isDeleted ? 'border-gray-300' // Deleted style (no opacity/strikethrough)
          : item.is_urgent && isActive ? 'border-red-500 border-2' // Urgent style (removed pulse)
          : !item.is_urgent && isActive ? 'border-blue-200' // Regular active
          : 'border-gray-200 opacity-75' // Completed style
        } p-4 flex flex-col justify-between transition-shadow hover:shadow-md min-h-[200px]`}
      >
        {/* Card Content */}
        <div>
            <div className="flex justify-between items-start mb-2 pb-2 border-b border-gray-100">
                <div>
                <h3 className={`text-base font-semibold ${isDeleted ? 'text-gray-600' : 'text-gray-800'}`}>{item.company}</h3>
                <p className={`text-sm ${isDeleted ? 'text-gray-500' : 'text-gray-500'}`}>{item.program}</p>
                </div>
                {isDeleted ? ( <span className="status-badge-gray">삭제됨</span> )
                : item.is_urgent && isActive ? ( <span className="status-badge-red">🚨 긴급</span> )
                : !isActive && !isDeleted ? ( <span className="status-badge-gray">완료</span> ) : null }
            </div>
            <div className="space-y-2 text-sm mb-3">
                <p className={isDeleted ? 'text-gray-600' : 'text-gray-600'}><span className="font-medium mr-1">📅 픽업일:</span> {item.pickup_date}</p>
                {item.note && (<p className={`${isDeleted ? 'text-gray-600' : 'text-gray-600'} bg-yellow-50 p-2 rounded border border-yellow-100 text-xs`}><span className="font-medium mr-1">📝 메모:</span> {item.note}</p>)}
                {!isActive && !isDeleted && (<p className="text-gray-500 text-xs"><span className="font-medium mr-1">🕒 완료:</span> {formatDate(item.updated_at || item.created_at)}</p>)}
                {isDeleted && (<p className="text-gray-500 text-xs"><span className="font-medium mr-1">🗑️ 삭제:</span> {formatDate(item.deleted_at)}</p>)}
            </div>
        </div>
        {/* Card Footer */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
           {item.image_url ? (<a href={item.image_url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline font-medium">🔗 원고 보기</a>)
           : (<span className={`text-sm ${isDeleted ? 'text-gray-500' : 'text-gray-500'}`}>{isDeleted ? '- 원고 없음 -' : '- 원고 없음 -'}</span>)}
          {isActive && (
            <div className="flex items-center space-x-2">
                 <button onClick={() => markComplete(item.id)} className="button-action-green">✅ 완료 처리</button>
                 <button onClick={() => handleDelete(item.id)} className="button-action-red">🗑️ 삭제</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // --- Render Loading State ---
   if (isLoading && requests.length === 0) { return (<div className="loading-container"><p className="loading-text">데이터 로딩 중...</p></div>); }

  // --- Render Main Content ---
  return (
    <DragDropContext onDragEnd={onDragEnd}>
        <div className="main-container">
            {/* Header */}
            <div className="header-container">
                <h1 className="header-title">비타민사인 작업 현황판</h1>
                {supabase && ( <button onClick={() => setShowForm(!showForm)} className="button-toggle-form"> {showForm ? '➖ 입력창 닫기' : '➕ 입력창 열기'} </button> )}
            </div>

            {/* Error Display */}
            {error && ( <div className="error-banner"> <strong className="font-bold">오류 발생: </strong> <span className="block sm:inline">{error}</span> <button onClick={() => setError(null)} className="error-close-button"> <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg> </button> </div> )}

            {/* Input Form */}
            {showForm && ( <div className="form-container"> {/* ... form content (no changes) ... */} </div> )}

            {/* Card Sections */}
            {/* Urgent Active Tasks Section */}
            {!isLoading && urgentActive.length > 0 && (
                <section className="mb-8">
                    <h2 className="section-title text-red-600"> <span className="mr-2 text-2xl">🔥</span> 긴급 작업 ({urgentActive.length}) </h2>
                    <Droppable droppableId={COLUMN_IDS.URGENT}>
                        {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className={`card-grid ${snapshot.isDraggingOver ? 'bg-red-50' : ''}`}>
                                {urgentActive.map((item, index) => (
                                    <Draggable key={item.id} draggableId={item.id.toString()} index={index}>
                                        {(providedDraggable: DraggableProvided, snapshotDraggable: DraggableStateSnapshot) => (
                                            <TaskCard item={item} provided={providedDraggable} snapshot={snapshotDraggable} />
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                </section>
            )}

            {/* Regular Active Tasks Section */}
            <section className="mb-8">
                <h2 className="section-title text-gray-700"> <span className="mr-2 text-blue-500 text-2xl">🟦</span> 진행 중인 작업 ({regularActive.length}) </h2>
                {/* ... (empty/loading states) ... */}
                {( !isLoading && (regularActive.length > 0 || urgentActive.length === 0) ) && ( // Render droppable only if not loading AND (regular tasks exist OR no tasks exist at all)
                    <Droppable droppableId={COLUMN_IDS.REGULAR}>
                        {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className={`card-grid ${snapshot.isDraggingOver ? 'bg-blue-50' : ''}`}>
                                {regularActive.map((item, index) => (
                                    <Draggable key={item.id} draggableId={item.id.toString()} index={index}>
                                        {(providedDraggable: DraggableProvided, snapshotDraggable: DraggableStateSnapshot) => (
                                            <TaskCard item={item} provided={providedDraggable} snapshot={snapshotDraggable} />
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                 )}
                 {/* Handle Empty/Loading States Separately */}
                 {!isLoading && regularActive.length === 0 && urgentActive.length === 0 ? ( <div className="empty-state"> 진행 중인 작업이 없습니다. </div> )
                 : !isLoading && regularActive.length === 0 && urgentActive.length > 0 ? ( <div className="empty-state bg-blue-50 border-blue-200 text-blue-700"> 일반 진행 작업이 없습니다. (긴급 작업만 있습니다) </div> )
                 : isLoading && regularActive.length === 0 && urgentActive.length === 0? ( <div className="empty-state">진행 중인 작업 로딩 중...</div> ) : null}
            </section>

            {/* Completed Tasks Section */}
            <section className="mb-8">
                <h2 className="section-title text-gray-700"> <span className="mr-2 text-green-500 text-2xl">📦</span> 완료된 작업 (최근 {completed.length}개) </h2>
                 {/* ... (empty/loading states) ... */}
                 { (!isLoading && completed.length > 0) && ( // Render droppable only if not loading and tasks exist
                    <Droppable droppableId={COLUMN_IDS.COMPLETED}>
                         {(provided: DroppableProvided, snapshot: DroppableStateSnapshot) => (
                            <div ref={provided.innerRef} {...provided.droppableProps} className={`card-grid ${snapshot.isDraggingOver ? 'bg-green-50' : ''}`}>
                                {completed.map((item, index) => (
                                    <Draggable key={item.id} draggableId={item.id.toString()} index={index} isDragDisabled={true}>
                                        {(providedDraggable: DraggableProvided, snapshotDraggable: DraggableStateSnapshot) => (
                                            <TaskCard item={item} provided={providedDraggable} snapshot={snapshotDraggable} />
                                        )}
                                    </Draggable>
                                ))}
                                {provided.placeholder}
                            </div>
                        )}
                    </Droppable>
                  )}
                  {/* Handle Empty/Loading States Separately */}
                  {!isLoading && completed.length === 0 ? ( <div className="empty-state"> 완료된 작업이 없습니다. </div> )
                  : isLoading && completed.length === 0 ? ( <div className="empty-state">완료된 작업 로딩 중...</div> ) : null }
            </section>

            {/* Recently Deleted Section (MODIFIED: Use Draggable with isDragDisabled) */}
            <section>
                <h2 className="section-title text-gray-500"> <span className="mr-2 text-2xl">🗑️</span> 최근 삭제된 작업 (최대 10개) </h2>
                 {/* ... (empty/loading states) ... */}
                { (!isLoading && recentlyDeleted.length > 0) && ( // Render only if not loading and tasks exist
                    // Not Droppable, but items are wrapped in Draggable(disabled)
                    <div className="card-grid">
                        {recentlyDeleted.map((item, index) => (
                            // Wrap with Draggable but disable it
                            <Draggable key={item.id} draggableId={item.id.toString()} index={index} isDragDisabled={true}>
                                {(providedDraggable: DraggableProvided, snapshotDraggable: DraggableStateSnapshot) => (
                                    <TaskCard
                                        item={item}
                                        provided={providedDraggable} // Pass real (but disabled) props
                                        snapshot={snapshotDraggable}
                                    />
                                )}
                            </Draggable>
                        ))}
                    </div>
                 )}
                 {/* Handle Empty/Loading States Separately */}
                 {!isLoading && recentlyDeleted.length === 0 ? ( <div className="empty-state"> 최근 삭제된 작업이 없습니다. </div> )
                 : isLoading && recentlyDeleted.length === 0 ? ( <div className="empty-state">삭제된 작업 로딩 중...</div> ) : null}
            </section>

             {/* Reusable styles */}
             <style jsx>{`
                .main-container { @apply min-h-screen bg-gradient-to-br from-blue-50 via-gray-50 to-indigo-50 p-4 md:p-6 font-sans text-gray-800; }
                .loading-container { @apply min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-gray-50 to-indigo-50; }
                .loading-text { @apply text-xl text-gray-500 animate-pulse; }
                .header-container { @apply flex flex-wrap justify-between items-center mb-6 pb-4 border-b border-gray-200; }
                .header-title { @apply text-2xl md:text-3xl font-bold text-indigo-800; }
                .error-banner { @apply bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4; }
                .error-close-button { @apply absolute top-0 bottom-0 right-0 px-4 py-3; }
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
                .section-title { @apply text-xl font-semibold mb-4 flex items-center; }
                .card-grid { @apply grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4; }
                .empty-state { @apply bg-white rounded-lg shadow border border-gray-200 p-10 text-center text-gray-500; }
                .status-badge-gray { @apply bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs whitespace-nowrap; }
                .status-badge-red { @apply bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap; }
                .button-action-green { @apply bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium hover:bg-green-200 transition whitespace-nowrap; }
                .button-action-red { @apply bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-medium hover:bg-red-200 transition whitespace-nowrap; }
                .button-toggle-form { @apply mt-2 md:mt-0 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-5 rounded-lg shadow-sm transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500; }
            `}</style>
        </div>
    </DragDropContext>
  );
}