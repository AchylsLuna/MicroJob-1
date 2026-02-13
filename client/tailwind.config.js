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
    extend: {},
  },
  plugins: [],
};
