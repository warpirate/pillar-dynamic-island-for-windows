/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Design tokens for PILLAR
      colors: {
        // Semantic color palette
        'pill-bg': {
          DEFAULT: 'rgba(20, 20, 22, 0.85)',
          light: 'rgba(30, 30, 35, 0.75)',
          dark: 'rgba(15, 15, 18, 0.9)',
        },
        'pill-border': 'rgba(255, 255, 255, 0.08)',
        'pill-accent': {
          DEFAULT: '#EB0028', // PILLAR red
          muted: 'rgba(235, 0, 40, 0.95)',
        },
        'pill-danger': {
          DEFAULT: '#ef4444',
          light: 'rgba(239, 68, 68, 0.3)',
        },
        'pill-success': {
          DEFAULT: '#22c55e',
          light: 'rgba(34, 197, 94, 0.4)',
        },
        'pill-warning': {
          DEFAULT: '#f59e0b',
          light: 'rgba(245, 158, 11, 0.2)',
        },
        'pill-muted': {
          DEFAULT: 'rgba(255, 255, 255, 0.8)',
          light: 'rgba(255, 255, 255, 0.6)',
          lighter: 'rgba(255, 255, 255, 0.5)',
          lightest: 'rgba(255, 255, 255, 0.1)',
        },
      },
      spacing: {
        // Consistent spacing scale for pill components
        'pill-xs': '0.125rem', // 2px
        'pill-sm': '0.25rem',  // 4px
        'pill-md': '0.5rem',   // 8px
        'pill-lg': '0.75rem',  // 12px
        'pill-xl': '1rem',     // 16px
        'pill-2xl': '1.5rem',  // 24px
        'pill-3xl': '2rem',    // 32px
      },
      borderRadius: {
        // Consistent border radius scale
        'pill-sm': '0.5rem',   // 8px
        'pill-md': '0.75rem',   // 12px
        'pill-lg': '1rem',      // 16px
        'pill-xl': '1.125rem',  // 18px
        'pill-2xl': '1.25rem',  // 20px
        'pill-3xl': '1.75rem',  // 28px
        'pill-full': '9999px',
      },
      fontSize: {
        // Consistent typography scale
        'pill-xs': ['10px', { lineHeight: '1.2', letterSpacing: '0.01em' }],
        'pill-sm': ['11px', { lineHeight: '1.3', letterSpacing: '0.01em' }],
        'pill-base': ['12px', { lineHeight: '1.4', letterSpacing: '0.01em' }],
        'pill-md': ['13px', { lineHeight: '1.4', letterSpacing: '0.02em' }],
        'pill-lg': ['18px', { lineHeight: '1.2', letterSpacing: '0.02em', fontWeight: '600' }],
      },
      animation: {
        'slide-up-fade': 'slideUpFade 0.4s ease-out',
      },
      keyframes: {
        slideUpFade: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
