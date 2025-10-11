const { hairlineWidth } = require('nativewind/theme')

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./WebVoiceAgent.{js,jsx,ts,tsx}",
    "./RealtimeVoiceAgent.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./stores/**/*.{js,jsx,ts,tsx}",
    "./types/**/*.{js,jsx,ts,tsx}",
    "./services/**/*.{js,jsx,ts,tsx}",
    "./app/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      borderWidth: {
        hairline: hairlineWidth(),
      },
    },
  },
  plugins: [],
}

