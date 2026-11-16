'use client';
import { useState, useEffect } from 'react';
import { IconSearch, IconPlus, IconUpload, IconEye, IconEyeOff, IconX } from './ui/icons';

interface TopBarProps {
  title: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onShowForm: () => void;
  onShowFileDrop: () => void;
  showForm: boolean;
  editMode: boolean;
  // '지남 숨김'은 진행 현황 화면에만 있다
  showOverdueToggle: boolean;
  hideOverdue: boolean;
  onToggleHideOverdue: () => void;
  overdueHiddenCount: number;
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 상단 막대 (넓은 화면 전용 — 왼쪽 메뉴 SideNav와 한 쌍)
 * 화면 이름과 오늘 날짜, 검색, 그리고 가장 자주 쓰는 두 버튼(출력요청·새 작업 등록)만 둔다.
 */
export default function TopBar({
  title,
  searchQuery,
  onSearchChange,
  onShowForm,
  onShowFileDrop,
  showForm,
  editMode,
  showOverdueToggle,
  hideOverdue,
  onToggleHideOverdue,
  overdueHiddenCount,
}: TopBarProps) {
  // 날짜는 브라우저에서만 계산 (서버가 만든 화면과 어긋나지 않게)
  const [today, setToday] = useState('');
  useEffect(() => {
    const d = new Date();
    setToday(`${d.getMonth() + 1}월 ${d.getDate()}일 ${DAY_NAMES[d.getDay()]}요일`);
  }, []);

  return (
    <header className="hidden lg:block lg:ml-[76px] sticky top-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-300 dark:border-slate-800 shadow-sm">
      <div className="flex items-center h-16 gap-4 px-6">
        {/* 화면 이름 + 오늘 날짜 */}
        <div className="shrink-0 leading-tight">
          <h1 className="text-[19px] font-extrabold tracking-tight text-brand dark:text-slate-100 whitespace-nowrap">{title}</h1>
          <p className="text-[11px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap h-[14px]">{today}</p>
        </div>

        {/* 검색 */}
        <div className="flex items-center flex-1 max-w-lg ml-4 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-transparent rounded-full px-4 h-10 focus-within:bg-white dark:focus-within:bg-slate-900 focus-within:border-brand/40 dark:focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-brand/10 transition">
          <IconSearch className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="업체명, 프로그램명, 작업자, 메모 검색"
            className="bg-transparent outline-none focus:ring-0 focus:border-transparent border-0 px-2.5 text-sm w-full text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="flex items-center justify-center w-6 h-6 rounded-full text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 shrink-0 transition"
              aria-label="검색어 지우기"
            >
              <IconX className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto shrink-0">
          {showOverdueToggle && (
            <button
              onClick={onToggleHideOverdue}
              className={`inline-flex items-center gap-1.5 h-10 px-3.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition ${
                hideOverdue
                  ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {hideOverdue ? <IconEyeOff className="w-4 h-4" /> : <IconEye className="w-4 h-4" />}
              {hideOverdue ? `지남 숨김 (${overdueHiddenCount})` : '지남 표시 중'}
            </button>
          )}

          <button
            onClick={onShowFileDrop}
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap hover:border-brand/40 hover:text-brand dark:hover:text-white transition"
          >
            <IconUpload className="w-4 h-4" />
            출력요청
          </button>

          <button
            onClick={onShowForm}
            className="inline-flex items-center gap-1.5 h-10 px-5 rounded-full bg-brand-orange text-sm font-bold text-brand whitespace-nowrap shadow-sm hover:bg-brand-orange-dark active:scale-[0.98] transition"
          >
            <IconPlus className="w-4 h-4" />
            {showForm ? '입력 닫기' : editMode ? '수정 중...' : '새 작업 등록'}
          </button>
        </div>
      </div>
    </header>
  );
}
