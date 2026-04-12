/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0a0a0a',
        surface: '#18181A',
        surfaceHighlight: '#27272a',
        primary: '#E60000', // Spin & Go Red
        primaryHover: '#cc0000',
        pokerGreen: '#0d5924',
        pokerGreenHighlight: '#16913c',
        gold: '#FACC15',
      },
      backgroundImage: {
        'spin-gradient': 'linear-gradient(135deg, #18181A 0%, #3f0909 100%)',
      }
    },
  },
  plugins: [],
}

