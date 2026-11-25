import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // dev: forward /api to the Express server (npm run dev in /server)
    proxy: { '/api': 'http://localhost:5000' },
  },
})
