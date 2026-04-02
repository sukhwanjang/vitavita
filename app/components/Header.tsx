'use client';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onPrintTodayWork: () => void;
  onShowForm: () => void;
  showForm: boolean;
  editMode: boolean;
  justUploadCount: number;
}

export default function Header({ 
  searchQuery, 
  onSearchChange, 
  onPrintTodayWork, 
  onShowForm, 
  showForm, 
  editMode,
  justUploadCount 
}: HeaderProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col w-full">
      {/* justUpload 알림 배너 */}
      {justUploadCount > 0 && (
        <div className="w-full bg-yellow-300 text-yellow-900 font-bold text-center py-2 rounded-xl mb-2 shadow animate-pulse">
          바쁘니까 미리 올려둔 파일이 {justUploadCount}개 있습니다! 
          <button 
            className="underline ml-2" 
            onClick={() => router.push('/justupload')}
          >
            바로가기
          </button>
        </div>
      )}
      
      <div className="flex items-center justify-between max-w-screen-2xl mx-auto mb-4 gap-4">
        {/* 로고 */}
        <div className="flex items-center gap-2">
          <img 
            src="/logo.png" 
            alt="Vitamin Sign Logo" 
            className="h-12 object-contain cursor-pointer" 
            onClick={() => { router.push('/'); onSearchChange(''); }}
          />
          
          {/* 검색창 */}
          <div className="ml-4 flex items-center bg-gray-100 rounded-full px-3 py-1 shadow-inner border border-gray-200 focus-within:ring-2 focus-within:ring-blue-300 z-10 relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
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
        <div className="flex gap-3">
          <button
            onClick={onPrintTodayWork}
            className="bg-gradient-to-r from-blue-500 to-blue-400 text-white font-bold px-5 py-2 rounded-xl shadow-lg hover:scale-105 hover:from-blue-600 hover:to-blue-500 transition text-base"
          >
            <span className="inline-block align-middle mr-1">🗒️</span> 오늘 작업 출력
          </button>
          
          <button
            onClick={onShowForm}
            className="bg-black text-white font-bold px-5 py-2 rounded-xl shadow-lg hover:bg-gray-900 hover:scale-105 transition text-base"
          >
            <span className="inline-block align-middle mr-1">➕</span> 
            {showForm ? '입력 닫기' : editMode ? '수정 중...' : '작업 추가'}
          </button>
          
          <button
            onClick={() => router.push('/completed')}
            className="bg-green-50 text-green-800 border border-green-200 font-bold px-5 py-2 rounded-xl flex items-center gap-2 shadow hover:bg-green-100 hover:scale-105 transition text-base"
          >
            <span className="text-lg">✅</span> 완료 보기
          </button>
          
          <button
            onClick={() => router.push('/deleted')}
            className="bg-gray-50 text-gray-500 border border-gray-200 font-bold px-5 py-2 rounded-xl flex items-center gap-2 shadow hover:bg-gray-100 hover:scale-105 transition text-base"
          >
            <span className="text-lg">🗑</span> 삭제 보기
          </button>
          
          <button
            onClick={() => router.push('/justupload')}
            className="bg-yellow-200 text-yellow-900 border border-yellow-400 font-bold px-5 py-2 rounded-xl shadow hover:bg-yellow-300 hover:scale-105 transition text-base"
          >
            바쁘니까 일단 올려둠
          </button>
        </div>
      </div>
    </div>
  );
} 