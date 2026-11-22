import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Served from https://<user>.github.io/gym-app/
export default defineConfig({
  base: '/gym-app/',
  // Shown in the profile so it is easy to tell which version is running.
  define: { __BUILD_TIME__: JSON.stringify(new Date().toISOString()) },
  plugins: [
    react(),
    VitePWA({
      // 'prompt': a new version waits until we apply it, so it can never reload mid-workout.
      registerType: 'prompt',
      includeAssets: ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
      workbox: {
        // Precache the exercise images too, so the gym's bad reception does not matter.
        globPatterns: ['**/*.{js,css,html,png,jpg,svg,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3_000_000,
      },
      manifest: {
        name: 'יומן כושר',
        short_name: 'יומן כושר',
        description: 'מעקב אימוני כוח והיפרטרופיה',
        lang: 'he',
        dir: 'rtl',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0e1116',
        theme_color: '#0e1116',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
