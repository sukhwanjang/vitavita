// layout.tsx
import './globals.css';
import type { Metadata } from 'next';

// ✅ 크롬 탭 제목과 favicon 설정
export const metadata: Metadata = {
  title: '비타민사인 현황판',
  description: '비타민사인 현황판',
  icons: {
    icon: '/vitaLogo.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* 다크모드: 저장된 테마를 렌더링 전에 적용 (화면 번쩍임 방지) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('vitavita_theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
        {/* ✅ 외부 폰트 로딩 (Pretendard + Noto Sans KR 폴백) */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
