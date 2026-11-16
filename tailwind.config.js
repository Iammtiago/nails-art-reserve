// Every color comes from CSS variables (src/app/globals.css + theme from Settings),
// so the admin can change the palette without rebuilding.

const withAlpha = (name) => `rgb(var(--color-${name}-rgb) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
const config = {
  content: ['./src/**/*.{js,jsx}', './shared/**/*.js'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: withAlpha('primary'),
          ink: 'var(--color-primary-ink)',
          soft: 'var(--color-primary-soft)',
          on: 'var(--color-on-primary)',
        },
        secondary: {
          DEFAULT: withAlpha('secondary'),
          soft: 'var(--color-secondary-soft)',
          on: 'var(--color-on-secondary)',
        },
        accent: {
          DEFAULT: withAlpha('accent'),
          ink: 'var(--color-accent-ink)',
          soft: 'var(--color-accent-soft)',
          on: 'var(--color-on-accent)',
        },
        bg: withAlpha('bg'),
        surface: withAlpha('surface'),
        ink: {
          DEFAULT: withAlpha('text'),
          2: 'var(--color-text-2)',
          3: 'var(--color-text-3)',
        },
        line: 'var(--color-line)',
        success: { DEFAULT: '#1F7A4D', soft: '#E3F4EA' },
        warning: { DEFAULT: '#8A5A00', soft: '#FDF1D8' },
        danger: { DEFAULT: '#B42335', soft: '#FCE7EA' },
        info: { DEFAULT: '#1F5FA8', soft: '#E4EEFA' },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      boxShadow: {
        glass: '0 1px 0 rgb(255 255 255 / 0.7) inset, 0 12px 32px -12px rgb(var(--color-primary-rgb) / 0.22)',
        lift: '0 18px 40px -18px rgb(var(--color-primary-rgb) / 0.35)',
        focus: '0 0 0 3px rgb(var(--color-accent-rgb) / 0.35)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0.35', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-up': {
          from: { transform: 'translateY(24px)', opacity: '0.4' },
          to: { transform: 'translateY(0)', opacity: '1' },
        },
        drift: {
          '0%, 100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(3%,-2%,0) scale(1.06)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        'sheet-up': 'sheet-up 240ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
        drift: 'drift 26s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
