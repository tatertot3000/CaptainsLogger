import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { localDiskDbPlugin } from './vite-disk-plugin';
// @ts-ignore
import { execSync } from 'child_process';

declare const process: any;

const getAppVersion = (): string => {
  if (process.env.VITE_APP_VERSION) {
    const v = process.env.VITE_APP_VERSION.trim();
    return v.startsWith('v') ? v : `v${v}`;
  }
  if (process.env.GITHUB_RUN_NUMBER) {
    return `v1.0.${process.env.GITHUB_RUN_NUMBER}`;
  }
  try {
    const gitCount = execSync('git rev-list --count HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (gitCount) {
      return `v1.0.${gitCount}`;
    }
  } catch {}
  return 'v1.0.0';
};

const appVersion = getAppVersion();

export default defineConfig({
  base: './',
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion),
  },
  plugins: [
    react(),
    localDiskDbPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: "Captain's Logger — Sailboat Maintenance & Fuel Log",
        short_name: "Captain's Log",
        description: 'Offline-first sailboat maintenance tracker, fuel log, and marine parts catalog.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
          {
            src: 'apple-touch-icon.png',
            sizes: '180x180',
            type: 'image/png',
          },
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-leaflet': ['leaflet'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
});
