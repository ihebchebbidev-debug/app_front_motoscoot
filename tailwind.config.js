/** @type {import('tailwindcss').Config} */
// Local Tailwind config — replaces the CDN script + inline `tailwind.config = {…}`
// that used to live in index.html. Mirrors that config exactly so no class
// name changes downstream. Purges based on the actual files we ship.
import typography from '@tailwindcss/typography';

export default {
  darkMode: 'class',
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './components/**/*.{ts,tsx,js,jsx}',
    './hooks/**/*.{ts,tsx}',
    './context/**/*.{ts,tsx}',
    './config/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
    './utils/**/*.{ts,tsx}',
  ],
  // Safelist a few dynamic class shapes used in formatting helpers and
  // status-driven badges. Without this they get purged because the literal
  // class string is built at runtime.
  safelist: [
    { pattern: /^(bg|text|border|ring)-(primary|success|warning|gray|destructive|brand)-(50|100|200|300|400|500|600|700|800|900)$/ },
    { pattern: /^(bg|text|border)-(brand)-(facebook|whatsapp|instagram|youtube|plate)(-hover|-dark|-bg|-bg-hover)?$/ },
    'animate-fade-in', 'animate-fade-in-up', 'animate-scale-in', 'animate-heartbeat',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      colors: {
        primary: {
          50:  'hsl(var(--primary-50))',
          100: 'hsl(var(--primary-100))',
          200: 'hsl(var(--primary-200))',
          300: 'hsl(var(--primary-300))',
          400: 'hsl(var(--primary-400))',
          500: 'hsl(var(--primary-500))',
          600: 'hsl(var(--primary-600))',
          700: 'hsl(var(--primary-700))',
          800: 'hsl(var(--primary-800))',
          900: 'hsl(var(--primary-900))',
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        gray: {
          50:  'hsl(var(--gray-50))',
          100: 'hsl(var(--gray-100))',
          200: 'hsl(var(--gray-200))',
          300: 'hsl(var(--gray-300))',
          400: 'hsl(var(--gray-400))',
          500: 'hsl(var(--gray-500))',
          600: 'hsl(var(--gray-600))',
          700: 'hsl(var(--gray-700))',
          800: 'hsl(var(--gray-800))',
          900: 'hsl(var(--gray-900))',
        },
        slate: {
          50:  'hsl(var(--gray-50))',
          100: 'hsl(var(--gray-100))',
          200: 'hsl(var(--gray-200))',
          300: 'hsl(var(--gray-300))',
          400: 'hsl(var(--gray-400))',
          500: 'hsl(var(--gray-500))',
          600: 'hsl(var(--gray-600))',
          700: 'hsl(var(--gray-700))',
          800: 'hsl(var(--gray-800))',
          900: 'hsl(var(--gray-900))',
          950: 'hsl(var(--gray-900))',
        },
        success: {
          50:  'hsl(var(--success-50))',
          100: 'hsl(var(--success-100))',
          200: 'hsl(var(--success-200))',
          300: 'hsl(var(--success-300))',
          400: 'hsl(var(--success-400))',
          500: 'hsl(var(--success-500))',
          600: 'hsl(var(--success-600))',
          700: 'hsl(var(--success-700))',
          800: 'hsl(var(--success-800))',
          900: 'hsl(var(--success-900))',
        },
        warning: {
          50:  'hsl(var(--warning-50))',
          100: 'hsl(var(--warning-100))',
          400: 'hsl(var(--warning-400))',
          500: 'hsl(var(--warning-500))',
          600: 'hsl(var(--warning-600))',
          700: 'hsl(var(--warning-700))',
        },
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        surface: {
          DEFAULT: 'hsl(var(--surface))',
          muted: 'hsl(var(--surface-muted))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        brand: {
          facebook:        '#1877F2',
          'facebook-hover':'#166FE5',
          whatsapp:        '#25D366',
          'whatsapp-dark': '#128C7E',
          'whatsapp-bg':   '#F3FFF6',
          'whatsapp-bg-hover': '#e8f9ed',
          instagram:       '#E4405F',
          youtube:         '#1E2329',
          plate:           '#FFDE00',
        },
      },
      letterSpacing: {
        'tighter': '-0.04em', 'tight': '-0.02em', 'normal': '0em',
        'wide': '0.025em', 'wider': '0.05em', 'widest': '0.1em',
      },
      lineHeight: {
        'tight': '1.2', 'snug': '1.35', 'normal': '1.5', 'relaxed': '1.625',
      },
      keyframes: {
        'fade-in-up': { '0%': { opacity: '0', transform: 'translateY(20px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'fade-in':    { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'scale-in':   { '0%': { opacity: '0', transform: 'scale(0.95)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        'heartbeat':  { '0%': { transform: 'scale(1)' }, '14%': { transform: 'scale(1.2)' }, '28%': { transform: 'scale(1)' }, '42%': { transform: 'scale(1.2)' }, '70%': { transform: 'scale(1)' } },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'fade-in':    'fade-in 0.4s ease-out forwards',
        'scale-in':   'scale-in 0.3s ease-out forwards',
        'heartbeat':  'heartbeat 1.5s ease-in-out infinite',
      },
    },
  },
  // Typography plugin powers the `prose-*` utilities used by ArticleDetails,
  // TipDetails, Legal pages AND the rich-text editor's live preview — keep
  // the editor and the public page looking identical.
  plugins: [typography],
};
