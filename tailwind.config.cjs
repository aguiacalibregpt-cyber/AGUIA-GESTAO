/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#0f766e', 50: '#e0f2f1', 500: '#0f766e', 600: '#0d5f59' },
      },
    },
  },
  plugins: [],
}
