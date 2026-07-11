'use client';
import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  IconSearch,
  IconPlus,
  IconPrinter,
  IconUpload,
  IconEye,
  IconEyeOff,
  IconMoon,
  IconSun,
} from './ui/icons';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onPrintTodayWork: () => void;
  onShowForm: () => void;
  onShowFileDrop: () => void;
  showForm: boolean;
  editMode: boolean;
  hideOverdue: boolean;
  onToggleHideOverdue: () => void;
  overdueHiddenCount: number;
}

const NAV_TABS = [
  { href: '/', label: '진행 현황' },
  { href: '/completed', label: '완료' },
  { href: '/deleted', label: '삭제' },
];

export default function Header({
  searchQuery,
  onSearchChange,
  onPrintTodayWork,
  onShowForm,
  onShowFileDrop,
  showForm,
  editMode,
  hideOverdue,
  onToggleHideOverdue,
  overdueHiddenCount,
}: HeaderProps) {
  const router = useRouter();
  const pathname = usePathname();

  // 다크모드 토글 (선택은 이 브라우저에 저장)
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);
  const toggleTheme = () => {
    const next = !document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', next);
    localStorage.setItem('vitavita_theme', next ? 'dark' : 'light');
    setIsDark(next);
  };

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 shadow-sm">
      {/* 상단 앱바 */}
      <div className="max-w-screen-2xl mx-auto px-4 md:px-6">
        <div className="flex items-center h-16 gap-4">
          {/* 브랜드 */}
          <button
            className="flex items-center gap-3 shrink-0"
            onClick={() => { router.push('/'); onSearchChange(''); }}
          >
            <img src="/logo.png" alt="Vitamin Sign" className="h-9 object-contain dark:brightness-0 dark:invert" />
            <span className="hidden xl:flex flex-col items-start leading-tight">
              <span className="text-[15px] font-bold text-slate-900 dark:text-slate-100 tracking-tight">비타민사인</span>
              <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">작업 현황 관리 시스템</span>
            </span>
          </button>

          <div className="hidden md:block h-6 w-px bg-slate-200 dark:bg-slate-700 shrink-0" />

          {/* 검색 */}
          <div className="flex items-center flex-1 max-w-md bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 h-10 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:bg-white dark:focus-within:bg-slate-800 transition">
            <IconSearch className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => onSearchChange(e.target.value)}
              placeholder="업체명, 프로그램명, 작업자 검색"
              className="bg-transparent outline-none focus:ring-0 focus:border-transparent border-0 px-2.5 text-sm w-full text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="text-[11px] font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"
              >
                지우기
              </button>
            )}
          </div>

          {/* 우측 액션 */}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <button
              onClick={toggleTheme}
              title={isDark ? '밝은 화면으로' : '어두운 화면으로'}
              className="inline-flex items-center justify-center w-9 h-9 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500 dark:text-amber-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition"
            >
              {isDark ? <IconSun className="w-4 h-4" /> : <IconMoon className="w-4 h-4" />}
            </button>

            <button
              onClick={onPrintTodayWork}
              className="hidden lg:inline-flex items-center gap-1.5 h-9 px-3.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 transition"
            >
              <IconPrinter className="w-4 h-4" />
              오늘 작업 출력
            </button>

            <button
              onClick={onShowFileDrop}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100 transition"
            >
              <IconUpload className="w-4 h-4" />
              출력요청
            </button>

            <button
              onClick={onShowForm}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 active:bg-blue-800 transition shadow-sm"
            >
              <IconPlus className="w-4 h-4" />
              {showForm ? '입력 닫기' : editMode ? '수정 중...' : '새 작업 등록'}
            </button>
          </div>
        </div>
      </div>

      {/* 하단 탭 네비게이션 */}
      <div className="border-t border-slate-100 dark:border-slate-800">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-6 flex items-center">
          <nav className="flex items-center gap-1 -mb-px">
            {NAV_TABS.map(tab => {
              const active = pathname === tab.href;
              return (
                <button
                  key={tab.href}
                  onClick={() => router.push(tab.href)}
                  className={`relative inline-flex items-center gap-1.5 h-11 px-4 text-sm font-medium border-b-2 transition ${
                    active
                      ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          {/* 지남 숨김 토글 */}
          <button
            onClick={onToggleHideOverdue}
            className={`ml-auto inline-flex items-center gap-1.5 h-7 px-3 rounded text-xs font-medium border transition ${
              hideOverdue
                ? 'bg-slate-800 text-white border-slate-800 dark:bg-slate-200 dark:text-slate-900 dark:border-slate-200'
                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            {hideOverdue ? <IconEyeOff className="w-3.5 h-3.5" /> : <IconEye className="w-3.5 h-3.5" />}
            {hideOverdue ? `지남 숨김 (${overdueHiddenCount})` : '지남 표시 중'}
          </button>
        </div>
      </div>

    </header>
  );
}
