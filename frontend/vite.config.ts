import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { adminPreviewPlugin } from './dev/adminPreview';

/** Pas de feuilles Google Fonts bloquantes dans l'aperçu isolé. */
function previewFonts(): Plugin {
  return {
    name: 'ca-immo-local-preview-font',
    transformIndexHtml(html) {
      return html.replace(/\s*<link\b[^>]*href="https:\/\/fonts\.(?:googleapis|gstatic)\.com[^\"]*"[^>]*\/?>/g, '')
        .replace('</head>', `<style>@font-face{font-family:Inter;font-style:normal;font-weight:100 900;font-display:swap;src:url('/fonts/inter-latin.woff2') format('woff2')}</style></head>`);
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        next();
      });
    },
  };
}

// Le build d'aperçu est explicitement opt-in, séparé de dist et de la production.
// Le mock ne vit que dans le serveur Vite et n'a aucun proxy vers une API réelle.
export default defineConfig(({ mode }) => {
  const preview = mode === 'admin-preview';
  return {
    plugins: [react(), tailwindcss(), ...(preview ? [adminPreviewPlugin(), previewFonts()] : [])],
    define: preview ? {
      'import.meta.env.VITE_API_URL': JSON.stringify('/api/v1'),
      'import.meta.env.VITE_ISOLATED_PREVIEW': JSON.stringify('true'),
    } : {},
    build: preview ? {
      outDir: '.cache/admin-preview',
      rollupOptions: {
        output: {
          // Une requête d'icônes, pas des dizaines de petits modules en cascade.
          manualChunks(id) {
            if (id.includes('/node_modules/lucide-react/')) return 'icons';
          },
        },
      },
    } : undefined,
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      host: '0.0.0.0',
      allowedHosts: true,
      // Seulement l'aperçu fictif : ses modules doivent charger en iframe opaque.
      cors: preview ? true : undefined,
      proxy: preview ? undefined : {
        '/api': { target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8000', changeOrigin: true },
        '/storage': { target: process.env.API_PROXY_TARGET ?? 'http://127.0.0.1:8000', changeOrigin: true },
      },
    },
    preview: {
      host: '0.0.0.0',
      allowedHosts: true,
      // Seulement l'aperçu fictif : ses modules doivent charger en iframe opaque.
      cors: preview ? true : undefined,
      port: Number(process.env.ADMIN_PREVIEW_PORT ?? 3000),
      strictPort: true,
    },
  };
});
