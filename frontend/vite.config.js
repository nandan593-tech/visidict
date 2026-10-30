import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['182f-2406-7400-867c-6922-9ca3-b447-7403-739d.ngrok-free.app']
  }
})
