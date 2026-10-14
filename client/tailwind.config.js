/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#28342d",
        paper: "#f9f7f3",
        clay: "#a16850",
        sage: "#dfe5db",
        sand: "#eee9e1",
      },
      fontFamily: {
        display: ["Georgia", "Times New Roman", "serif"],
        sans: ["Inter", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
