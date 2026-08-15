/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ember: { DEFAULT: '#FF4D5E', dark: '#D93A4A' },
      },
    },
  },
  plugins: [],
};
