import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Video's en debug-afbeeldingen niet precachen (groot); het spel zelf
      // (app-shell + bord + fonts) werkt offline voor potjes tegen de computer.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2}', 'afbeeldingen/speelbord*', 'icons/*.png'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        // De Firebase auth-handler (/__/auth/*, geproxied via vercel.json)
        // mag NOOIT door de service worker worden afgevangen
        navigateFallbackDenylist: [/^\/__\//],
      },
      manifest: {
        name: 'Tric-Trac — het klassieke bordspel',
        short_name: 'Tric-Trac',
        description: 'Speel Tric-Trac tegen de computer of online tegen een vriend.',
        lang: 'nl',
        display: 'fullscreen',
        orientation: 'landscape',
        background_color: '#0a0a0a',
        theme_color: '#5d4433',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
