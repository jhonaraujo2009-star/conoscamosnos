import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const APP_BUILD_ID = `${(process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 8)}-${Date.now().toString(36)}`;

function appVersionManifestPlugin(buildId) {
  const payload = JSON.stringify({
    buildId,
    builtAt: new Date().toISOString(),
  });
  return {
    name: 'app-version-manifest',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = (req.url || '').split('?')[0];
        if (pathname === '/version.json') {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');
          res.end(payload);
          return;
        }
        next();
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: payload,
      });
    },
  };
}

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_BUILD_ID': JSON.stringify(APP_BUILD_ID),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  plugins: [
    react(),
    appVersionManifestPlugin(APP_BUILD_ID),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      filename: 'pwa-sw.js',
      includeAssets: [],
      manifest: {
        id: '/',
        name: 'Conoscamosnos — Citas, Amistad y Chat Global',
        short_name: 'Conoscamosnos',
        description: 'App global de citas, búsqueda de amigos y chat en tiempo real con regalos virtuales.',
        lang: 'es',
        theme_color: '#FBF6F0',
        background_color: '#FBF6F0',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['social', 'lifestyle'],
        prefer_related_applications: false,
        related_applications: [
          {
            platform: 'play',
            id: 'app.vercel.conoscamosnos.twa',
          },
          {
            platform: 'webapp',
            url: 'https://conoscamosnos.vercel.app/manifest.webmanifest',
          },
        ],
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],
        globIgnores: ['sw.js', 'firebase-messaging-sw.js', 'ad-viewer.html', 'downloads/**', 'version.json'],
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ request, url }) =>
              request.mode === 'navigate' &&
              !url.pathname.startsWith('/api/') &&
              !url.pathname.startsWith('/downloads/') &&
              !url.pathname.startsWith('/.well-known/') &&
              url.pathname !== '/ad-viewer.html',
            handler: 'NetworkOnly',
          },
          {
            urlPattern: ({ url }) => url.pathname === '/version.json',
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'cloudinary-images',
              expiration: {
                maxEntries: 120,
                maxAgeSeconds: 60 * 60 * 24 * 14,
              },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/messaging'],
          icons: ['lucide-react'],
        },
      },
    },
  },
});
