import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import dotenv from 'dotenv';
import fs from 'fs';

export default defineConfig(({mode}) => {
  // Force load from .env file directly to bypass any harness overrides
  if (fs.existsSync('.env')) {
    const envConfig = dotenv.parse(fs.readFileSync('.env'));
    for (const k in envConfig) {
      process.env[k] = envConfig[k];
    }
  }

  const env = loadEnv(mode, process.cwd(), '');
  
  // 1. Get from process.env (AI Studio Secrets)
  // 2. Fallback to env (from .env files)
  let apiKey = process.env.CUSTOM_GEMINI_KEY || env.CUSTOM_GEMINI_KEY || process.env.GEMINI_API_KEY || env.GEMINI_API_KEY || "";
  let googleMapsKey = process.env.GOOGLE_MAPS_API_KEY || env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || env.VITE_GOOGLE_MAPS_API_KEY || "";
  
  // Strip out the placeholder
  if (apiKey === "MY_GEMINI_API_KEY" || apiKey === "undefined") {
    apiKey = "";
  }

  if (googleMapsKey === "undefined") {
    googleMapsKey = "";
  }

  // Force expose to Vite's import.meta.env as a backup
  process.env.VITE_GEMINI_API_KEY = apiKey;
  process.env.VITE_GOOGLE_MAPS_API_KEY = googleMapsKey;

  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true,
          navigateFallback: 'index.html',
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365 // <== 365 days
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        },
        devOptions: {
          enabled: true
        },
        includeAssets: ['favicon.ico', 'logopwa.png'],
        manifest: {
          name: 'RouteKing - Courier Edition',
          short_name: 'RouteKing',
          description: 'Aplikasi pengurusan parcel dan optimasi laluan untuk rider kurier.',
          theme_color: '#2563eb',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          id: '/',
          icons: [
            {
              src: 'logopwa.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'logopwa.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'logopwa.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        }
      })
    ],
    define: {
      '__GEMINI_API_KEY__': JSON.stringify(apiKey),
      'process.env.GEMINI_API_KEY': JSON.stringify(apiKey),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(apiKey),
      '__GOOGLE_MAPS_API_KEY__': JSON.stringify(googleMapsKey),
      'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(googleMapsKey),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâ€”file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
