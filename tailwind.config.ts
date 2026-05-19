import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: "#1a4a2e",
          dark: "#0f2d1c",
          light: "#245c39",
        },
        gold: {
          DEFAULT: "#c9a84c",
          light: "#e0c06b",
          dark: "#a07830",
        },
      },
      fontFamily: {
        display: ["Georgia", "Cambria", "serif"],
        mono: ["Courier New", "monospace"],
      },
      animation: {
        "deal-in": "dealIn 0.4s ease-out forwards",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-slow": "pulse 2s infinite",
      },
      keyframes: {
        dealIn: {
          "0%": { opacity: "0", transform: "translateY(-40px) rotate(-5deg) scale(0.8)" },
          "100%": { opacity: "1", transform: "translateY(0) rotate(0deg) scale(1)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
