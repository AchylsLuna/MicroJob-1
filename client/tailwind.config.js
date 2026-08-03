import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    resolve(__dirname, "index.html"),
    resolve(__dirname, "src/**/*.{js,ts,jsx,tsx}")
  ],
  theme: {
    extend: {
      colors: {
        blue: {
          50: "rgb(28 77 141 / 0.06)",
          100: "rgb(28 77 141 / 0.1)",
          200: "rgb(28 77 141 / 0.2)",
          300: "rgb(28 77 141 / 0.3)",
          400: "rgb(28 77 141 / 0.4)",
          500: "#1C4D8D",
          600: "#1C4D8D",
          700: "#1C4D8D",
          800: "#1C4D8D",
          900: "#1C4D8D",
          950: "#1C4D8D",
        },
      },
    },
  },
  plugins: [],
};
