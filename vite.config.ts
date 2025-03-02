import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.VITE_API_URL || (mode === 'production' ? 'https://mirrormuse.onrender.com' : 'http://localhost:3000');
  const isDev = mode === 'development';

  return {
    base: '/',
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
          target: apiUrl,
          changeOrigin: true,
          secure: !apiUrl.startsWith('http://localhost'),
          ws: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          configure: (proxy) => {
            proxy.on('error', (err) => {
              console.error('代理服务器错误:', err);
            });
            proxy.on('proxyReq', (proxyReq, req) => {
              console.log(`发送请求: ${req.method} ${req.url}`);
            });
            proxy.on('proxyRes', (proxyRes, req) => {
              console.log(`收到响应: ${proxyRes.statusCode} ${req.url}`);
            });
          }
        }
      }
    },
    preview: {
      port: 5173,
      host: true,
      strictPort: true
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: isDev,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: !isDev,
          drop_debugger: true,
          pure_funcs: ['console.info']
        }
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              return id.toString().split('node_modules/')[1].split('/')[0];
            }
          },
          assetFileNames: 'assets/[name].[hash].[ext]',
          chunkFileNames: 'assets/[name].[hash].js',
          entryFileNames: 'assets/[name].[hash].js'
        }
      }
    }
  };
});
