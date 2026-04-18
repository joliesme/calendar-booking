/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        sage: {
          50:  '#f4f7f0',
          100: '#e8ede3',
          200: '#d2dfc8',
          300: '#b4c99a',
          400: '#93af6c',
          500: '#6f924a',
          600: '#567539',
          700: '#435c2c',
          800: '#374a26',
          900: '#2e3e21',
        },
        coral: {
          50:  '#fff2f0',
          100: '#ffe1dc',
          400: '#f4826d',
          500: '#e85c45',
          600: '#d44530',
          700: '#b33325',
        },
        lime: {
          100: '#f0f9d4',
          300: '#d4ee7a',
          400: '#c2e052',
          500: '#aacf2e',
          600: '#8baa20',
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)',
        'card-hover': '0 4px 12px 0 rgb(0 0 0 / 0.08), 0 2px 4px -1px rgb(0 0 0 / 0.04)',
      }
    },
  },
  plugins: [],
}
