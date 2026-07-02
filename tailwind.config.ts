import type { Config } from "tailwindcss";

// The visual system is driven by the ported mockup CSS in src/app/globals.css
// (CSS variables + component classes). Tailwind is available for incremental
// layout work; brand tokens are mirrored here for utility usage.
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0A0A0A",
        paper: "#FFFFFF",
        neon: {
          yellow: "#F0F000",
          pink: "#F03090",
          cyan: "#00C0F0",
          green: "#50F000",
          red: "#F01010",
        },
      },
      fontFamily: {
        sans: ['"Noto Sans JP"', "sans-serif"],
        mono: ['"Montserrat"', '"Noto Sans JP"', "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
