/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      spacing: {
        18: '4.5rem',
      },
      boxShadow: {
        'glow-violet': '0 0 24px rgba(124, 58, 237, 0.15)',
        'glow-violet-sm': '0 0 12px rgba(124, 58, 237, 0.10)',
      },
      animation: {
        'dash': 'dash 12s linear infinite',
        'pulse-dot': 'pulse 1.5s cubic-bezier(0.4,0,0.6,1) infinite',
      },
      keyframes: {
        dash: {
          to: { strokeDashoffset: '-100' },
        },
      },
    },
  },
  plugins: [],
};
