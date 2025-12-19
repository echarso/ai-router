import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5005,
    proxy: {
      '/keycloak': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/auth-api': {
        target: 'http://localhost:5007',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/auth-api/, '')
      },
      '/api': {
        target: 'http://localhost:5006',
        changeOrigin: true
      }
    }
  }
})

