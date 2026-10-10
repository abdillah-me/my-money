import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string }

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      // Aktifkan service worker saat `npm run dev` agar fitur PWA bisa diuji tanpa build
      devOptions: {
        enabled: true,
        type: 'module',
        navigateFallback: 'index.html',
      },
      manifest: {
        id: '/',
        name: 'Wahduid - Money Management',
        short_name: 'Wahduid',
        description: 'Catat pemasukan dan pengeluaran dengan mudah, bahkan saat offline.',
        lang: 'id',
        dir: 'ltr',
        theme_color: '#16a34a',
        background_color: '#f5f8f6',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['finance', 'productivity'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Pintasan saat ikon aplikasi ditekan lama (Android / desktop)
        shortcuts: [
          {
            name: 'Tambah pengeluaran',
            short_name: 'Pengeluaran',
            url: '/transactions/new?type=expense',
            icons: [{ src: 'maskable-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Tambah pemasukan',
            short_name: 'Pemasukan',
            url: '/transactions/new?type=income',
            icons: [{ src: 'maskable-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Split Bill',
            short_name: 'Split Bill',
            url: '/split-bill/new',
            icons: [{ src: 'maskable-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        // Cache Google Fonts agar tetap tampil saat offline
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
})
