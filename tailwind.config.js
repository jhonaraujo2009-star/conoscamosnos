/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Outfit"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
      },
      colors: {
        brand: {
          50: '#fff1f3',
          100: '#ffe4e8',
          200: '#fecdd6',
          300: '#fda4b4',
          400: '#fb718d',
          500: '#FF2E54',
          600: '#e11d48',
          700: '#be123c',
          800: '#9f1239',
          900: '#881337',
        },
        vip: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
      },
      boxShadow: {
        'soft': '0 10px 30px -6px rgba(15, 23, 42, 0.08), 0 2px 6px -1px rgba(15, 23, 42, 0.04)',
        'luxury': '0 24px 60px -14px rgba(15, 23, 42, 0.16), 0 4px 16px -2px rgba(255, 46, 84, 0.08)',
        'card': '0 2px 12px -2px rgba(15, 23, 42, 0.05), 0 1px 3px 0 rgba(15, 23, 42, 0.03)',
      },
      keyframes: {
        floatUp: {
          '0%': { transform: 'translateY(40px) scale(0.6)', opacity: '0' },
          '20%': { transform: 'translateY(0px) scale(1.15)', opacity: '1' },
          '80%': { transform: 'translateY(-35px) scale(1.05)', opacity: '1' },
          '100%': { transform: 'translateY(-90px) scale(0.9)', opacity: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(255, 46, 84, 0.3)' },
          '50%': { boxShadow: '0 0 24px 4px rgba(245, 158, 11, 0.35)' },
        },
        confettiFall: {
          '0%': { transform: 'translateY(-20vh) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(100vh) rotate(540deg)', opacity: '0' },
        },
      },
      animation: {
        'float-up': 'floatUp 3s ease-out forwards',
        'shimmer': 'shimmer 2.5s linear infinite',
        'pulse-glow': 'pulseGlow 2.4s ease-in-out infinite',
        'confetti': 'confettiFall 2.8s linear infinite',
      },
    },
  },
  plugins: [],
};
