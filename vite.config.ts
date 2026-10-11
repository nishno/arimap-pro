import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const geminiKey = ''; // Provider secrets must stay on the authenticated backend.
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [

        react(),
        tailwindcss(),
        VitePWA({
          registerType: 'prompt',
          injectRegister: false,
          devOptions: {
            enabled: false
          },
          workbox: {
            maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
            globPatterns: ['**/*.{js,css,html,ico,png,svg,json}']
          },
          includeAssets: ['agrimap-icon.svg'],
          manifest: {
            name: 'AgriMap Pro',
            short_name: 'AgriMap',
            description: 'Advanced Agricultural Management & Mapping Platform',
            theme_color: '#16a34a',
            icons: [
              {
                src: '/agrimap-icon.svg',
                sizes: 'any',
                type: 'image/svg+xml'
              },
              {
                src: '/agrimap-icon.svg',
                sizes: 'any',
                type: 'image/svg+xml'
              },
              {
                src: '/agrimap-icon.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'any maskable'
              }
            ]
          }
        })
      ],
      optimizeDeps: {
        include: [
          'react',
          'react-dom',
          'leaflet',
          'react-leaflet',
          '@turf/turf',
          'firebase/app',
          'firebase/auth',
          'firebase/firestore',
          'lucide-react',
          '@google/genai',
          'd3',
          'three'
        ]
      },
      build: {
        chunkSizeWarningLimit: 3000,
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) {
                if (id.includes('three')) return 'vendor-three';
                if (id.includes('@google/genai')) return 'vendor-genai';
                if (id.includes('leaflet') || id.includes('turf')) return 'vendor-maps';
                if (id.includes('pptxgenjs') || id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-export';
                if (id.includes('firebase')) return 'vendor-firebase';
                if (id.includes('lucide-react')) return 'vendor-icons';
                if (id.includes('d3')) return 'vendor-d3';
                if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) return 'vendor-react';
              }
            }
          }
        }
      },
      define: {
        'process.env.API_KEY': JSON.stringify(geminiKey),
        'process.env.GEMINI_API_KEY': JSON.stringify(geminiKey),
        'process.env.VITE_GEMINI_API_KEY': JSON.stringify(geminiKey),
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(geminiKey),
        global: 'globalThis',
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        }
      }
    };
});
