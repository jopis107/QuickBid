/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        base: '#0f172a',
        panel: '#1e293b',
        line: '#334155',
        accent: '#3b82f6',
        accentSoft: '#60a5fa',
      },
    },
  },
  plugins: [],
}