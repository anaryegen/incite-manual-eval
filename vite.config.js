import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/incite-eval/',
  server: {
    proxy: {
      '/submit': 'http://localhost:3001'
    }
  }
})
