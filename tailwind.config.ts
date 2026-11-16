import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {fontFamily: {
      sans: ['"Noto Sans KR"', 'sans-serif'],
    },
      // 브랜드 색 — 로고에서 뽑은 남색과 주황색
      colors: {
        brand: {
          DEFAULT: '#001133', // 로고 남색
          soft: '#0d2350',    // 남색 위 눌림·호버
          line: '#1b2f5c',    // 남색 위 구분선
          orange: '#ff8800',  // 로고 주황색
          'orange-dark': '#e67a00',
        },
      },
      animation: {
        fall: "fall 10s linear infinite",
      },
      keyframes: {
        fall: {
          "0%": { transform: "translateY(-10%) rotate(0deg)" },
          "100%": { transform: "translateY(110vh) rotate(360deg)" },
        },
      },
      
    },
  },
  plugins: [],
};

export default config;
