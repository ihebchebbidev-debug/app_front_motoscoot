import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { seoSnapshotsPlugin } from './src/seo/vitePluginSeoSnapshots';

// Emits /version.json into the build output so the running app can poll it
// and detect when a new deploy is available (see hooks/useAppVersion.ts).
function versionManifestPlugin(): Plugin {
  return {
    name: 'version-manifest',
    apply: 'build',
    generateBundle() {
      const version =
        process.env.VERCEL_GIT_COMMIT_SHA ||
        process.env.COMMIT_SHA ||
        String(Date.now());
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version, builtAt: new Date().toISOString() }),
      });
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    const apiTarget = env.VITE_API_PROXY_TARGET || 'http://localhost:4000';
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          // In development, /api is proxied to the local Node backend.
          // In production, set VITE_API_BASE_URL=https://api.moto-scoot.tn/api
          '/api': {
            target: apiTarget,
            changeOrigin: true,
            secure: false,
          },
          '/uploads': {
            target: apiTarget,
            changeOrigin: true,
            secure: false,
          },
          // SEO-friendly media URLs: /m/<slug>/<file> → backend /uploads/<file>
          // /m/<slug>/t/<file> → backend /uploads/thumbnails/<file>
          '^/m/': {
            target: apiTarget,
            changeOrigin: true,
            secure: false,
            rewrite: (p: string) => {
              // /m/<slug>/t/<file>  → /uploads/thumbnails/<file>
              const t = p.match(/^\/m\/[^/]+\/t\/(.+)$/);
              if (t) return `/uploads/thumbnails/${t[1]}`;
              // /m/<slug>/<file...> → /uploads/<file...>
              const m = p.match(/^\/m\/[^/]+\/(.+)$/);
              if (m) return `/uploads/${m[1]}`;
              return p;
            },
          },
        },
      },
      plugins: [react(), versionManifestPlugin(), seoSnapshotsPlugin()],
      optimizeDeps: {
        // heic2any is a UMD bundle that breaks Vite's ESM dep optimization
        // (forced re-optimization invalidates the React chunk and yields
        // "Cannot read properties of null (reading 'useState')"). We only
        // import it dynamically when the user picks an iPhone HEIC photo, so
        // excluding it from pre-bundling is safe and keeps React stable.
        exclude: ['heic2any'],
      },
      define: {
        // Only expose the Gemini API key if it is explicitly opt-in via the
        // VITE_GEMINI_API_KEY env var (prefix "VITE_" = intentional client exposure).
        'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || ''),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      esbuild: {
        // Strip dev-only console noise in production bundles for smaller JS
        // and a faster main thread. Errors/warnings stay so monitoring works.
        drop: mode === 'production' ? (['debugger'] as ('debugger' | 'console')[]) : [],
        pure: mode === 'production' ? ['console.log', 'console.debug', 'console.info'] : [],
      },
      build: {
        target: 'es2020',
        cssCodeSplit: true,
        reportCompressedSize: false, // faster builds
        // Bumped warning threshold; we intentionally do NOT manually split
        // chunks anymore. Manual splitting React across multiple chunks
        // (`react-vendor` + `vendor`) caused a load-order race that produced:
        //   "Cannot set properties of undefined (setting 'Activity')"
        // because react-dom touched React internals before React fully booted.
        // Vite/Rollup's default chunking keeps React + its dependents together
        // and is reliable. Size warnings here are acceptable.
        chunkSizeWarningLimit: 1500,
      },
    };
});
