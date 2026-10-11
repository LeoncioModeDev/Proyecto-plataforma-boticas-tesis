import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      ignored: [
        '**/modelo-ml/**',
        '**/modelo-ml-v2/**',
        '**/data/**',
        '**/reports/**',
        '**/.venv/**',
        '**/.venv311/**',
        '**/__pycache__/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
