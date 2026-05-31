/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{html,ts,scss}',
  ],
  // Let Angular Material manage colors/typography — only enable utilities
  corePlugins: {
    preflight: false, // avoid conflicts with Angular Material's global reset
  },
  theme: {
    extend: {},
  },
  plugins: [],
};
