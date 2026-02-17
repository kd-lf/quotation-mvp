import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/quotation-mvp/',   // <-- add this
  plugins: [react()],
})
