/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f2f0ff',
          100: '#e6e2ff',
          200: '#c9c0ff',
          300: '#a696ff',
          400: '#8266ff',
          500: '#6238ff',
          600: '#4f1fe0',
          700: '#3e17b0',
          800: '#2e1180',
          900: '#1f0c56',
        },
      },
    },
  },
  plugins: [],
};
