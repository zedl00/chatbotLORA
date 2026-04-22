// Ruta: /tailwind.config.ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#bcd9ff',
          300: '#8dc0ff',
          400: '#569dff',
          500: '#2b7bff',
          600: '#155df5',
          700: '#1149e0',
          800: '#143db5',
          900: '#163a8e'
        },
        surface: {
          DEFAULT: '#ffffff',
          muted: '#f5f7fa',
          border: '#e5e9f0'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem'
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.05), 0 1px 2px -1px rgb(0 0 0 / 0.05)',
        pop: '0 10px 30px -10px rgb(0 0 0 / 0.25)'
      }
    }
  },
  plugins: []
} satisfies Config
