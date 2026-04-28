import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // 允许外部访问
    port: 5173,
    strictPort: false,
    watch: {
      usePolling: true, // 支持Docker环境下的文件监听
      interval: 1000
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8003',
        changeOrigin: true
      },
      '/scheduler-api': {
        target: 'http://localhost:8012',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/scheduler-api/, '')
      }
    }
  },
  build: {
    watch: {} // 启用构建监听
  }
});
