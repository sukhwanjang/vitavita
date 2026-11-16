'use client';
import { useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  IconGrid,
  IconCheckCircle,
  IconTrash,
  IconReceipt,
  IconPalette,
  IconBell,
  IconCalculator,
  IconFrame,
  IconMoon,
  IconSun,
} from './ui/icons';

// 왼쪽 메뉴 너비(px) — 본문·출력대기 패널이 이만큼 오른쪽으로 밀린다 (board.tsx, FileSidebar.tsx의 lg:pl-/lg:left- 값과 맞출 것)
export const SIDE_NAV_WIDTH = 76;

interface SideNavProps {
  onShowCalculator: () => void;
  onShowFrameCalc: () => void;
  onShowColorNotes: () => void;
  onShowNotice: () => void; // 공지 수정 창 열기 (비밀번호 확인부터)
  onHome?: () => void; // 로고를 눌렀을 때 (검색어 지우기 등)
}

const NAV_ITEMS = [
  { href: '/', label: '진행', Icon: IconGrid },
  { href: '/completed', label: '완료', Icon: IconCheckCircle },
  { href: '/deleted', label: '삭제', Icon: IconTrash },
  { href: '/settlement', label: '정산', Icon: IconReceipt },
];

function RailButton({
  active = false,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  title: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`relative flex flex-col items-center justify-center gap-1 w-[60px] h-[54px] rounded-xl text-[11px] font-semibold transition ${
        active
          ? 'bg-white/[0.14] text-white'
          : 'text-slate-300/80 hover:bg-white/[0.08] hover:text-white'
      }`}
    >
      {/* 현재 화면 표시: 왼쪽 주황 막대 */}
      {active && <span className="absolute -left-2 top-3 bottom-3 w-1 rounded-r bg-brand-orange" />}
      {children}
    </button>
  );
}

/**
 * 왼쪽 고정 메뉴 (넓은 화면 전용 — 좁은 화면은 기존 상단 Header를 그대로 쓴다)
 * 로고 남색 바탕에 화면 이동(진행·완료·삭제·정산)과 도구(색상 기록·계산기·액자재단)를 모았다.
 */
export default function SideNav({ onShowCalculator, onShowFrameCalc, onShowColorNotes, onShowNotice, onHome }: SideNavProps) {
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
    <nav
      className="hidden lg:flex flex-col items-center fixed inset-y-0 left-0 z-40 bg-brand py-3 gap-1"
      style={{ width: SIDE_NAV_WIDTH }}
      aria-label="주 메뉴"
    >
      {/* 로고 */}
      <button
        onClick={() => { router.push('/'); onHome?.(); }}
        title="비타민사인 현황판"
        className="flex items-center justify-center w-11 h-11 mb-3 rounded-xl bg-white shadow-sm overflow-hidden transition hover:scale-105"
      >
        <img src="/vitaLogo.png" alt="비타민사인" className="w-8 h-8 object-contain" />
      </button>

      {NAV_ITEMS.map(({ href, label, Icon }) => (
        <RailButton key={href} active={pathname === href} title={label} onClick={() => router.push(href)}>
          <Icon className="w-5 h-5" />
          {label}
        </RailButton>
      ))}

      <span className="w-9 h-px bg-brand-line my-2" />

      <RailButton title="공지 — 화면 위에 계속 흘러가는 빨간 글씨 (수정은 비밀번호 필요)" onClick={onShowNotice}>
        <IconBell className="w-5 h-5" />
        공지
      </RailButton>
      <RailButton title="출력 색상 기록 — 거래처별로 어떤 모드로 찍었는지 메모" onClick={onShowColorNotes}>
        <IconPalette className="w-5 h-5" />
        색상
      </RailButton>
      <RailButton title="단가 계산기" onClick={onShowCalculator}>
        <IconCalculator className="w-5 h-5" />
        계산기
      </RailButton>
      <RailButton title="액자 틀 재단 계산기" onClick={onShowFrameCalc}>
        <IconFrame className="w-5 h-5" />
        액자
      </RailButton>

      <span className="flex-1" />

      {/* 층간 방송 버튼 자리 — BroadcastPanel이 여기에 버튼을 끼워 넣는다 (화면 가운데를 가리지 않게) */}
      <div id="side-nav-broadcast-slot" />

      <RailButton title={isDark ? '밝은 화면으로' : '어두운 화면으로'} onClick={toggleTheme}>
        {isDark ? <IconSun className="w-5 h-5 text-amber-300" /> : <IconMoon className="w-5 h-5" />}
        {isDark ? '밝게' : '어둡게'}
      </RailButton>
    </nav>
  );
}
