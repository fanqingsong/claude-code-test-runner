import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react({
      // 禁用React Refresh以提高稳定性
      fastRefresh: false,
      // 禁用Babel插件的 JSX转换以避免问题
      babel: {
        plugins: []
      }
    })
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    cors: true,
    hmr: false,
    // 禁用压缩以提高稳定性
    compress: false
  },
  optimizeDeps: {
    force: true,
    include: ['react', 'react-dom', 'react-dom/client'],
    exclude: []
  },
  // 禁用源码映射以提高性能
  build: {
    sourcemap: false
  }
});
