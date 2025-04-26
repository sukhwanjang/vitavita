import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {fontFamily: {
      sans: ['"Noto Sans KR"', 'sans-serif'],
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
