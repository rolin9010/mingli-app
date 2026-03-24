import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    /** lunar-javascript 体积大，单独成包便于缓存与并行加载 */
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/lunar-javascript')) return 'lunar'
        },
      },
    },
    /** 单 chunk 仍可能 >500kB 时仅抑制提示；优先靠上面的拆包与动态 import */
    chunkSizeWarningLimit: 900,
  },
  server: {
    proxy: {
      '/api/deepseek': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/deepseek/, ''),
      },
    },
  },
})
