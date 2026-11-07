import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#fdf8f6",
          100: "#f2e8e5",
          200: "#eaddd7",
          500: "#a25f4b",
          600: "#8c4d3b",
          700: "#753c2c",
          900: "#442117",
        },
      },
    },
  },
  plugins: [],
};

export default config;
