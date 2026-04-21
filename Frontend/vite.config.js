import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),   // ← Tailwind v4 uses Vite plugin, not PostCSS
  ],
  server: {
    port: 3000,
  },
})