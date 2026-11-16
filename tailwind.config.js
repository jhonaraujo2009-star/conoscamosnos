/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Outfit"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#fff1f4',
          100: '#ffe4ea',
          200: '#fecdd8',
          300: '#fda4b8',
          400: '#fb7192',
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
        },
        cream: {
          50: '#FDFBF9',
          100: '#FAF7F5',
          200: '#F3EDE8',
          300: '#E8DFD7',
        }
      },
      boxShadow: {
        'soft': '0 8px 30px -4px rgba(15, 23, 42, 0.06), 0 2px 6px -1px rgba(15, 23, 42, 0.03)',
        'luxury': '0 20px 50px -12px rgba(244, 63, 110, 0.14), 0 4px 16px -2px rgba(15, 23, 42, 0.06)',
        'card': '0 4px 20px -2px rgba(15, 23, 42, 0.05), 0 1px 3px 0 rgba(15, 23, 42, 0.03)',
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
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(244, 63, 110, 0.35)' },
          '50%': { boxShadow: '0 0 24px 4px rgba(245, 158, 11, 0.4)' },
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
