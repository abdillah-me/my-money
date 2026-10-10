import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Konfigurasi tes terpisah dari vite.config.ts agar plugin PWA/Tailwind tidak ikut dijalankan
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
  },
})
