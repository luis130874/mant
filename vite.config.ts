import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

const APP_VERSION = '57.5.0';
const APP_BUILD_ID = `${APP_VERSION}-${Date.now()}`;

function prodexusVersionPlugin(): Plugin {
  const getStampedSwContent = () => {
    const swPath = path.resolve(__dirname, 'public/sw.js');
    if (!fs.existsSync(swPath)) return '';
    return fs.readFileSync(swPath, 'utf-8').replace(/__PRODEXUS_BUILD_ID__/g, APP_BUILD_ID);
  };

  const getVersionJsonContent = () =>
    JSON.stringify(
      {
        version: APP_VERSION,
        buildId: APP_BUILD_ID,
        updatedAt: new Date().toISOString(),
      },
      null,
      2
    );

  return {
    name: 'prodexus-version-control',
    transformIndexHtml(html) {
      return html
        .replace(/__PRODEXUS_APP_VERSION__/g, APP_VERSION)
        .replace(/__PRODEXUS_BUILD_ID__/g, APP_BUILD_ID);
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const cleanUrl = (req.url || '').split('?')[0];
        if (cleanUrl === '/version.json' || cleanUrl.endsWith('/version.json')) {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
          res.end(getVersionJsonContent());
          return;
        }
        if (cleanUrl === '/sw.js' || cleanUrl.endsWith('/sw.js')) {
          const swContent = getStampedSwContent();
          if (swContent) {
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            res.end(swContent);
            return;
          }
        }
        next();
      });
    },
    writeBundle(options) {
      const outDir = options.dir ? path.resolve(options.dir) : path.resolve(__dirname, 'dist');
      if (!fs.existsSync(outDir)) return;

      fs.writeFileSync(path.join(outDir, 'version.json'), getVersionJsonContent(), 'utf-8');

      const swContent = getStampedSwContent();
      if (swContent) {
        fs.writeFileSync(path.join(outDir, 'sw.js'), swContent, 'utf-8');
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), prodexusVersionPlugin()],
    define: {
      __APP_VERSION__: JSON.stringify(APP_VERSION),
      __APP_BUILD_ID__: JSON.stringify(APP_BUILD_ID),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
