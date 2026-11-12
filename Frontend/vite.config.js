

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: 'autoUpdate',

      // Habilitar PWA durante el desarrollo
      devOptions: {
        enabled: true,
        type: 'module'
      },

      // Configuración de caché
      workbox: {
        cleanupOutdatedCaches: true,

        globPatterns: [
          '**/*.{js,css,html,ico,png,svg,woff2}'
        ],

        runtimeCaching: [
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|webp)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'imagenes',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 2592000
              }
            }
          }
        ]
      },

      // Manifiesto de la PWA
      manifest: {
        name: 'Farmacia Dulce María',
        short_name: 'Farmacia DM',
        description: 'Sistema de gestión de inventario',

        theme_color: '#303030',
        background_color: '#303030',

        display: 'standalone',
        orientation: 'portrait',

        icons: [
          {
            src: '/cuadrado.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          }
        ]
      }
    })
  ]
})


/*import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})
*/