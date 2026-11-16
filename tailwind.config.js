/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff1f5',
          100: '#ffe4ec',
          200: '#fecdd9',
          300: '#fda4ba',
          400: '#fb7194',
          500: '#f43f6e',
          600: '#e11d54',
          700: '#be1245',
          800: '#9f123e',
          900: '#88133a',
        },
        vip: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        }
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
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(244, 63, 110, 0.45)' },
          '50%': { boxShadow: '0 0 24px 6px rgba(245, 158, 11, 0.55)' },
        },
        confettiFall: {
          '0%': { transform: 'translateY(-20vh) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(100vh) rotate(540deg)', opacity: '0' },
        }
      },
      animation: {
        'float-up': 'floatUp 3s ease-out forwards',
        'shimmer': 'shimmer 2.5s linear infinite',
        'pulse-glow': 'pulseGlow 2.4s ease-in-out infinite',
        'confetti': 'confettiFall 2.8s linear infinite',
      }
    },
  },
  plugins: [],
};
