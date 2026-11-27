import { cwd } from 'node:process'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode, command, isPreview }) => {
  const { VITE_ML_API_URL } = loadEnv(mode, cwd())
  const urlML = (VITE_ML_API_URL || 'http://127.0.0.1:8000').trim().replace(/\/+$/, '')

  return {
    plugins: [react()],
    server: {
      proxy: command === 'serve' && !isPreview ? {
        '/ml-api/': {
          target: urlML,
          changeOrigin: true,
          rewrite: ruta => ruta.replace(/^\/ml-api/, ''),
        },
      } : undefined,
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
  }
})
