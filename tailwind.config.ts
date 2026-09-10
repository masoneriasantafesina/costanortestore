import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        frost: {
          50: '#f0f8fb',
          100: '#dcedf3',
          200: '#b3d9e6',
          300: '#7fbdd3',
          400: '#4a9bb8',
          500: '#2c7a99',
          600: '#1f5f7d',
          700: '#1a4b64',
          800: '#173d52',
          900: '#0f2833',
        },
        mango: {
          50: '#fff7ed',
          100: '#ffedd5',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f2740c',
          600: '#c25a08',
        },
        ink: '#12191c',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
      },
      borderRadius: {
        card: '10px',
      },
    },
  },
  plugins: [],
};
export default config;
