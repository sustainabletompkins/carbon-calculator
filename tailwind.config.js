/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#5cb85c", // Finger Lakes Green
        secondary: "#5bc0de", // Finger Lakes Blue
        accent: "#0088cc", // Darker blue accent
        "background-light": "#e8f4f8", // Light blue-tinted background
        "background-dark": "#1f2937",
        "surface-light": "#ffffff",
        "surface-dark": "#374151",
        "text-light": "#2c3e50",
        "text-dark": "#f9fafb",
        "muted-light": "#6b7280",
        "muted-dark": "#9ca3af",
      },
      fontFamily: {
        display: ["Poppins", "sans-serif"],
      },
      borderRadius: {
        DEFAULT: "0.5rem",
      },
    },
  },
  plugins: [],
};
