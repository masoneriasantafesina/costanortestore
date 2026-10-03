import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Azul marino de la marca Tild@ (letras "Tild").
        frost: {
          50: '#eef3fc',
          100: '#d6e3f9',
          200: '#adc7f2',
          300: '#84a7e8',
          400: '#4f80da',
          500: '#255fc4',
          600: '#1447a3',
          700: '#0c3684',
          800: '#092868',
          900: '#051a47',
        },
        // Dorado/naranja del "sol" del @.
        mango: {
          50: '#fffbea',
          100: '#fff1c2',
          300: '#ffde6b',
          400: '#fdc92e',
          500: '#fdaa01',
          600: '#d98a00',
        },
        // Celeste de los rayitos y el puntito de la "i" — acento, uso moderado.
        sky: {
          50: '#eaf8fe',
          100: '#cdeffd',
          300: '#7fd4fb',
          400: '#4fc3fb',
          500: '#03abfc',
          600: '#0589cc',
          700: '#056fa6',
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
