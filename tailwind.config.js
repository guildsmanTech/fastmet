/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: [
    "./app/**/*.{js,jsx,ts,tsx}", // your app folder with layouts, screens
    "./components/**/*.{js,jsx,ts,tsx}", // if you have a components folder
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      fontFamily: {
        montserrat: ["Montserrat_400Regular", "sans-serif"],
        "montserrat-bold": ["Montserrat_700Bold", "sans-serif"],
      },
      colors: {
        lightPrimary: "#FFA840",
        darkPrimary: "#ED8718",
        secondary: "#0F2535",
        ctaSecondary: "#EBEBEB",
        ctaSecondaryActive: "#D9D9D9",
        brand: {
          navy: "#0F2535",
          orange: "#ED8718",
        },
      },
    },
  },
  plugins: [],
};
