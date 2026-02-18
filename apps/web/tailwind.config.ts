import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './content/**/*.{mdx,md}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#ec7a1c',
          50: '#fef7ee',
          100: '#fdedd6',
          200: '#f9d8ad',
          300: '#f5bc78',
          400: '#f09742',
          500: '#ec7a1c',
          600: '#dd6012',
          700: '#b74811',
          800: '#923a16',
          900: '#763215',
        },
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
}

export default config
