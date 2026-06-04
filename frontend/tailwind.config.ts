import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0F1B2D",      // brand dark
        brand: "#10B981",    // EIGG green
      },
    },
  },
  plugins: [],
};

export default config;
