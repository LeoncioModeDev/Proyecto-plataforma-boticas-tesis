/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        marca: {
          principal: '#107C41',
          oscuro: '#0B5C30',
          claro: '#E6F4EC',
          acento: '#2DA66B',
        },
        neutro: {
          blanco: '#FFFFFF',
          'blanco-suave': '#F8F9FA',
          'gris-borde': '#E1E1E1',
          'gris-texto': '#605E5C',
          negro: '#1B1B1B',
          'negro-suave': '#323130',
        },
        estado: {
          critico: '#A4262C',
          'critico-fondo': '#FDE7E9',
          advertencia: '#C19C00',
          'advertencia-fondo': '#FFF8E1',
          info: '#0078D4',
          'info-fondo': '#E6F2FF',
        },
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'h1': ['28px', { lineHeight: '36px', fontWeight: '600' }],
        'h2': ['22px', { lineHeight: '28px', fontWeight: '600' }],
        'h3': ['18px', { lineHeight: '24px', fontWeight: '600' }],
        'cuerpo': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'secundario': ['13px', { lineHeight: '18px', fontWeight: '400' }],
        'etiqueta': ['12px', { lineHeight: '16px', fontWeight: '500' }],
      },
      borderRadius: {
        'boton': '4px',
        'tarjeta': '8px',
      },
      boxShadow: {
        'suave': '0 1px 2px rgba(0, 0, 0, 0.06)',
        'media': '0 2px 8px rgba(0, 0, 0, 0.1)',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
    },
  },
  plugins: [],
}
