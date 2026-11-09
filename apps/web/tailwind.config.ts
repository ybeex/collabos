import type { Config } from 'tailwindcss'
import typography from '@tailwindcss/typography'

export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        // PRD_AUDIT.md Finding #5: mono now maps to DM Mono, per PRD §15's
        // "Body: DM Mono 400 13px" spec — this single mapping change is
        // what actually swaps every font-mono usage across the entire
        // app, since font-mono (not font-sans) is the primary body-text
        // class used throughout every component in this codebase.
        sans: ['system-ui', 'sans-serif'],
        mono: ['var(--font-dm-mono)', 'ui-monospace', 'monospace'],
        display: ['var(--font-syne)', 'system-ui', 'sans-serif'],
        // PRD §15: "Subheading: Fraunces Light Italic 18px" — a new
        // mapping, since nothing in the prior font setup covered this
        // named role at all.
        callout: ['var(--font-fraunces)', 'ui-serif', 'serif'],
      },
      colors: {
        // Design system tokens mapped to Tailwind
        ink: 'var(--color-ink)',
        paper: 'var(--color-paper)',
        accent: {
          DEFAULT: 'var(--color-accent)',
          foreground: 'var(--color-accent-foreground)',
        },
        border: 'var(--color-border)',
        input: 'var(--color-input)',
        ring: 'var(--color-ring)',
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        muted: {
          DEFAULT: 'var(--color-muted)',
          foreground: 'var(--color-muted-foreground)',
        },
        sidebar: {
          DEFAULT: 'var(--color-sidebar)',
          foreground: 'var(--color-sidebar-foreground)',
          border: 'var(--color-sidebar-border)',
        },
        card: {
          DEFAULT: 'var(--color-card)',
          foreground: 'var(--color-card-foreground)',
        },
      },
      borderRadius: {
        sm: '2px',
        DEFAULT: '3px',
        md: '4px',
        lg: '6px',
        xl: '8px',
      },
      animation: {
        'fade-in': 'fade-in 0.15s ease-out',
        'slide-up': 'slide-up 0.2s ease-out',
        'slide-down': 'slide-down 0.2s ease-out',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-down': {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [typography],
} satisfies Config
