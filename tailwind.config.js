/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        vroom: {
          black: '#08080C',     // Deeper, cooler black for the main background
          dark: '#0D0D14',      // Elevated surface (Sidebar/Header)
          card: '#12121A',      // Component cards
          surface: '#181824',   // Hover states / secondary surfaces
          border: '#1F1F2E',    // Subtle borders
          'border-bright': '#2A2A3F', // Hover borders / more visible separators
          accent: '#FF4D1C',    // Your signature orange
          'accent-dim': '#E63E10',
          'accent-glow': 'rgba(255,77,28,0.15)',
          amber: '#F59E0B',
          green: '#10B981',
          blue: '#3B82F6',
          muted: '#8E919E',     // Brighter muted text for better legibility
          subtle: '#374151',
          text: '#F3F4F6',      // Near-white text
          'text-dim': '#ADB0B9', // Balanced secondary text
        }
      },
      backgroundImage: {
        'road-gradient': 'radial-gradient(circle at top right, #12121A, #08080C)',
        'accent-gradient': 'linear-gradient(135deg, #FF4D1C 0%, #FF6B35 100%)',
        'card-gradient': 'linear-gradient(165deg, #12121A 0%, #0D0D14 100%)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0) 100%)',
      },
      boxShadow: {
        'accent': '0 0 30px rgba(255,77,28,0.2)',
        'accent-lg': '0 0 60px rgba(255,77,28,0.15)',
        'card': '0 10px 30px -10px rgba(0,0,0,0.5)',
        'card-hover': '0 20px 40px -15px rgba(0,0,0,0.7)',
        'inner-glow': 'inset 0 1px 1px rgba(255,255,255,0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'slide-right': 'slideRight 0.4s ease-out',
        'pulse-accent': 'pulseAccent 2s ease-in-out infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideRight: {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseAccent: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(255,77,28,0.2)' },
          '50%': { boxShadow: '0 0 40px rgba(255,77,28,0.4)' },
        },
      },
    },
  },
  plugins: [],
}
