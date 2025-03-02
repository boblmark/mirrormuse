import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.VITE_API_URL || 'http://localhost:3000';

  return {
    plugins: [react()],
    optimizeDeps: {
      exclude: ['lucide-react']
    },
    server: {
      port: 5173,
      strictPort: true,
      host: true,
      proxy: {
        '/api': {
          target: process.env.VITE_API_URL || 'http://localhost:3000',
          changeOrigin: true,
          secure: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/api/, '/api'),
          configure: (proxy, _options) => {
            proxy.on('error', (err, _req, _res) => {
              console.log('proxy error', err);
            });
            proxy.on('proxyReq', (proxyReq, req, _res) => {
              console.log('Sending Request:', req.method, req.url);
            });
            proxy.on('proxyRes', (proxyRes, req, _res) => {
              console.log('Received Response:', proxyRes.statusCode, req.url);
            });
          }
        }
      }
    },
    preview: {
      port: 5173,
      host: true
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: true,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: false,
          drop_debugger: true
        }
      },
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom'],
            ui: ['lucide-react']
          }
        }
      }
    }
  };
}
