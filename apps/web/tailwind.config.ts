import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'midnight-command': '#0F172A',
        'tactical-blue': '#3B82F6',
        'alert-amber': '#F59E0B',
        'slate-gray': '#64748B',
        'signal-white': '#F8FAFC',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
