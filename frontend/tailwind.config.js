/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#1a1a2e',
          light: '#16213e',
          lighter: '#1f3460',
        },
        accent: {
          DEFAULT: '#e94560',
          muted: '#e9456080',
        },
      },
    },
  },
  plugins: [],
};
