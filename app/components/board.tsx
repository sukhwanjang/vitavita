'use client';
import { useEffect, useState, ChangeEvent, ClipboardEvent, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Supabase URL or Anon Key is missing. Check your .env.local file.');
}

const supabase = createClient(supabaseUrl!, supabaseAnonKey!);
// 안녕
// Updated Interface
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
  is_urgent: boolean; // <-- Added Urgent flag
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
  const [isUrgent, setIsUrgent] = useState(false); // <-- State for Urgent checkbox
  // UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Data Fetching (no change needed, select('*') gets the new column) ---
  const fetchRequests = useCallback(async () => {
    setError(null);
    const { data, error: fetchError } = await supabase
      .from('request')
      .select('*')
      .order('is_urgent', { ascending: false }) // <-- Prioritize urgent items
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Error fetching requests:', fetchError);
      setError(`데이터 로딩 실패: ${fetchError.message}`);
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

  // --- Image Handling (no change) ---
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImage(file);
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => { setImagePreview(reader.result as string); }
        reader.readAsDataURL(file);
    } else { setImagePreview(null); }
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const fileName = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
    const { error: uploadError } = await supabase.storage.from('request-images').upload(fileName, file);
    if (uploadError) {
        console.error('Error uploading image:', uploadError);
        setError(`이미지 업로드 실패: ${uploadError.message}`);
        return null;
    }
    const { data: urlData } = supabase.storage.from('request-images').getPublicUrl(fileName);
    return urlData?.publicUrl || null;
  };

  // --- Form Submission (include is_urgent) ---
  const handleSubmit = async () => {
    if (!company || !program || !pickupDate) {
      setError('업체명, 프로그램명, 픽업일은 필수 항목입니다.');
      return;
    }
    setIsSubmitting(true);
    setError(null);

    let imageUrl: string | null = null;
    if (image) {
      imageUrl = await uploadImage(image);
      if (!imageUrl) { // <- 이걸로 바꿔야 정확함!
        setIsSubmitting(false);
        return;
      }
    }

    const { error: insertError } = await supabase
      .from('request')
      .insert([{
        company,
        program,
        pickup_date: pickupDate,
        note,
        image_url: imageUrl,
        completed: false,
        is_urgent: isUrgent // <-- Save urgent status
      }]);

    setIsSubmitting(false);

    if (insertError) {
      console.error('Error inserting request:', insertError);
      setError(`등록 실패: ${insertError.message}`);
    } else {
      // Clear form including isUrgent
      setCompany(''); setProgram(''); setPickupDate(''); setNote('');
      setImage(null); setImagePreview(null); setIsUrgent(false); // <-- Reset urgent state
      setShowForm(false);
      fetchRequests();
    }
  };

  // --- Mark as Complete (no change needed) ---
  const markComplete = async (id: number) => {
    setError(null);
    const { error: updateError } = await supabase
      .from('request')
      .update({ completed: true, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (updateError) {
      console.error('Error marking complete:', updateError);
      setError(`업데이트 실패: ${updateError.message}`);
    } else { fetchRequests(); }
  };

  // --- Paste Image Handling (no change) ---
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

  // --- Filtering Data (Split active into urgent and regular) ---
  const urgentActive = requests.filter(r => !r.completed && r.is_urgent);
  const regularActive = requests.filter(r => !r.completed && !r.is_urgent);
  const completed = requests.filter(r => r.completed).slice(0, 100);

  // --- Helper Function for Date Formatting (no change) ---
  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    try {
        return new Date(dateString).toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
    } catch (e) { return dateString; }
  };

  // --- Card Component (Updated styling for urgency) ---
  const TaskCard = ({ item }: { item: RequestItem }) => {
    const isActive = !item.completed; // Determine active state based on item data

    return (
      // Add Urgent styling: thicker red border if active and urgent
      <div className={`bg-white rounded-lg shadow border ${
          item.is_urgent && isActive ? 'border-red-500 border-2 animate-pulse' // <-- Urgent Style
          : !item.is_urgent && isActive ? 'border-blue-200'        // <-- Regular Active Style
          : 'border-gray-200 opacity-75'                           // <-- Completed Style
      } p-4 flex flex-col justify-between transition-shadow hover:shadow-md`}>
        <div> {/* Content Area */}
          <div className="flex justify-between items-start mb-2 pb-2 border-b border-gray-100">
            <div>
              <h3 className="text-base font-semibold text-gray-800">{item.company}</h3>
              <p className="text-sm text-gray-500">{item.program}</p>
            </div>
            {/* Show Urgent marker OR Completed badge */}
            {item.is_urgent && isActive && (
                 <span className="bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-bold whitespace-nowrap">🚨 긴급</span>
            )}
            {!isActive && (
              <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs whitespace-nowrap">완료</span>
            )}
          </div>

          <div className="space-y-2 text-sm mb-3">
            <p className="text-gray-600"><span className="font-medium mr-1">📅 픽업일:</span> {item.pickup_date}</p>
            {item.note && (<p className="text-gray-600 bg-yellow-50 p-2 rounded border border-yellow-100"><span className="font-medium mr-1">📝 메모:</span> {item.note}</p>)}
            {!isActive && (<p className="text-gray-500 text-xs"><span className="font-medium mr-1">🕒 완료:</span> {formatDate(item.updated_at || item.created_at)}</p>)}
          </div>
        </div>

        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
          {item.image_url ? (
            <a href={item.image_url} target="_blank" rel="noopener noreferrer" className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline font-medium">🔗 원고 보기</a>
          ) : (<span className="text-sm text-gray-400">- 원고 없음 -</span>)}

          {isActive && ( // Only show complete button if active
            <button onClick={() => markComplete(item.id)} className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-medium hover:bg-green-200 transition whitespace-nowrap">✅ 완료 처리</button>
          )}
        </div>
      </div>
    );
  }


  // --- Render ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-gray-50 to-indigo-50 p-4 md:p-6 font-sans text-gray-800">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mb-6 pb-4 border-b border-gray-200">
        <h1 className="text-2xl md:text-3xl font-bold text-indigo-800">비타민사인 작업 현황판</h1>
        <button onClick={() => setShowForm(!showForm)} className="mt-2 md:mt-0 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-5 rounded-lg shadow-sm transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
            {showForm ? '➖ 입력창 닫기' : '➕ 입력창 열기'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
          <strong className="font-bold">오류 발생: </strong> <span className="block sm:inline">{error}</span>
          <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3"> <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg> </button>
        </div>
      )}

      {/* Input Form (Added Urgent Checkbox) */}
      {showForm && (
        <div className="bg-white p-5 mb-6 rounded-lg shadow-md border border-gray-200 transition-all duration-300 ease-out">
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <input placeholder="업체명 *" value={company} onChange={(e) => setCompany(e.target.value)} className="input-style" required />
            <input placeholder="프로그램명 *" value={program} onChange={(e) => setProgram(e.target.value)} className="input-style" required />
            <input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="input-style text-gray-500" required />
           </div>
           <textarea placeholder="메모 (선택 사항)" value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="input-style mb-4" />
           {/* File Input Area */}
           <div className="border border-dashed border-gray-300 p-4 rounded-md text-center mb-4">
              <input type="file" accept="image/*" onChange={handleFileChange} className="file-input-style" />
               {imagePreview ? (
                <div className="mt-2"><img src={imagePreview} alt="Preview" className="max-h-40 mx-auto rounded" /><button onClick={() => { setImage(null); setImagePreview(null); }} className="button-text-red"> 이미지 제거 </button></div>
              ) : ( <p className="text-sm text-gray-500 mt-1"> 이미지 파일을 선택하거나, 📋 <kbd className="kbd-style">Ctrl</kbd> + <kbd className="kbd-style">V</kbd> 로 붙여넣으세요. </p> )}
           </div>

           {/* Urgent Checkbox & Submit Button */}
           <div className="flex flex-wrap justify-between items-center mt-4">
             {/* Urgent Checkbox */}
             <div className="flex items-center space-x-2">
                <input
                    type="checkbox"
                    id="isUrgentCheckbox"
                    checked={isUrgent}
                    onChange={(e) => setIsUrgent(e.target.checked)}
                    className="h-5 w-5 text-red-600 border-gray-300 rounded focus:ring-red-500 cursor-pointer"
                />
                <label htmlFor="isUrgentCheckbox" className="text-sm font-medium text-red-600 cursor-pointer">
                    🚨 급함 (Urgent)
                </label>
             </div>
             {/* Submit Button */}
             <button onClick={handleSubmit} disabled={isSubmitting} className={`button-primary-green ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}> {isSubmitting ? '등록 중...' : '📤 등록'} </button>
           </div>
        </div>
      )}

      {/* --- NEW: Urgent Active Tasks Section --- */}
      {urgentActive.length > 0 && ( // Only show section if there are urgent tasks
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-red-600 mb-4 flex items-center animate-pulse">
            <span className="mr-2 text-2xl">🔥</span> 긴급 작업 ({urgentActive.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {urgentActive.map((item) => (
              <TaskCard key={item.id} item={item} /> // Pass item, active state is derived inside
            ))}
          </div>
        </section>
      )}

      {/* --- Regular Active Tasks Section --- */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center">
          <span className="mr-2 text-blue-500 text-2xl">🟦</span> 진행 중인 작업 ({regularActive.length})
        </h2>
        {regularActive.length === 0 && urgentActive.length === 0 ? ( // Show empty only if NO active tasks at all
          <div className="empty-state"> 진행 중인 작업이 없습니다. </div>
        ) : regularActive.length === 0 ? (
          <div className="empty-state"> 일반 진행 작업이 없습니다. (긴급 작업만 있습니다) </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {regularActive.map((item) => (
               <TaskCard key={item.id} item={item} /> // Pass item, active state is derived inside
            ))}
          </div>
        )}
      </section>

      {/* --- Completed Tasks Section --- */}
      <section>
        <h2 className="text-xl font-semibold text-gray-700 mb-4 flex items-center">
          <span className="mr-2 text-green-500 text-2xl">📦</span> 완료된 작업 (최근 {completed.length}개)
        </h2>
         {completed.length === 0 ? (
          <div className="empty-state"> 완료된 작업이 없습니다. </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {completed.map((item) => (
               <TaskCard key={item.id} item={item} /> // Pass item, active state is derived inside
            ))}
          </div>
        )}
      </section>

      {/* Defining reusable styles here for brevity, move to CSS/globals.css with @apply for larger projects */}
      <style jsx>{`
        .input-style { @apply block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm; }
        .file-input-style { @apply block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 mb-2 cursor-pointer; }
        .button-text-red { @apply mt-1 text-xs text-red-500 hover:text-red-700; }
        .kbd-style { @apply px-2 py-1.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg; }
        .button-primary-green { @apply bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-5 rounded-lg shadow-sm transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500; }
        .empty-state { @apply bg-white rounded-lg shadow border border-gray-200 p-10 text-center text-gray-500; }
      `}</style>
    </div>
  );
}