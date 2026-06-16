/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#185FA5",
          dark: "#0C447C"
        }
      }
    }
  },
  plugins: []
};
