import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 4500,
    proxy: {
      '/login/oauth/access_token': {
        target: 'https://github.com',
        changeOrigin: true,
        secure: false,
      },
      '/user': {
        target: 'https://api.github.com',
        changeOrigin: true,
        secure: false,
      },
      '/api': {
        target: 'http://localhost:5080',
        changeOrigin: true,
        secure: false,
        ws: true,
      },
    },
  },
})

