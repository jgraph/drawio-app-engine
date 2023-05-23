import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import viteTsconfigPaths from 'vite-tsconfig-paths';
import svgrPlugin from 'vite-plugin-svgr';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteTsconfigPaths(),
    svgrPlugin(),
    {
      name: 'build-html',
      apply: 'build',
      transformIndexHtml: (html) => {
        return {
          html,
          tags: [
            {
              tag: 'script',
              attrs: {
                src: '/js/viewer-static.min.js',
                type: 'text/javascript'
              },
              injectTo: 'head',
            },
            {
              tag: 'script',
              attrs: {
                src: './js/common.js',
                type: 'text/javascript'
              },
              injectTo: 'head',
            },
          ],
        };
      },
    }
  ],
  base: './',
  build: {
    outDir: '../../src/main/webapp/connect/monday',
    emptyOutDir: true
  },
  optimizeDeps: {
    esbuildOptions: {
        // Node.js global to browser globalThis
        define: {
            global: 'globalThis',
        },
    },
  }
});

