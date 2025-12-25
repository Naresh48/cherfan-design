/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./*.html",
    "./**/*.html",
    "./script.js",
    "./styles.css"
  ],
  theme: {
    extend: {
      colors: {
        'brand-bg': '#ffffff',
        'brand-accent': '#1f1b18',
        'brand-wood': '#b76a45',
      },
      fontFamily: {
        'serif': ['Playfair Display', 'serif'],
        'sans': ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

