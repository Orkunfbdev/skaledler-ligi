/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        twitter: {
          bg: '#000000',
          card: '#16181c',
          border: '#2f3336',
          textMuted: '#71767b'
        }
      }
    },
  },
  plugins: [],
};
