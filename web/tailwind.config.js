/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        pastelPink: '#ffd1dc',
        pastelBlue: '#c1e1f7',
        pastelGreen: '#c8f7c5',
        pastelYellow: '#fff5ba',
        pastelPurple: '#e4c1f9',
      },
      fontFamily: {
        playful: ['"Comic Neue"', 'cursive'],
      },
      keyframes: {
        spriteWalk: {
          '100%': { backgroundPosition: '-96px 0' },
        },
      },
      animation: {
        spriteWalk: 'spriteWalk 1s steps(3) infinite',
      },
    },
  },
  plugins: [],
}
