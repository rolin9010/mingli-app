import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  plugins: [
    react(),
    // 为微信 WebView 等旧版内核生成传统格式（非 ES Module）降级包
    legacy({
      targets: ['ios >= 10', 'android >= 5', 'chrome >= 49'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      renderLegacyChunks: true,
    }),
    // 微信 WebView 兼容：去掉 HTML 里所有 crossorigin 属性
    // 微信内核对 crossorigin 处理有 bug，会导致 CSS/JS 加载失败
    // enforce: 'post' 确保在 legacy 插件注入完 nomodule 脚本之后再处理
    {
      name: 'remove-crossorigin',
      enforce: 'post' as const,
      apply: 'build' as const,
      transformIndexHtml(html: string) {
        return html.replace(/\s+crossorigin(?:="[^"]*")?/g, '')
      },
    },
  ],
  build: {
    /** 去掉 crossorigin 属性——微信 WebView 对 crossorigin 处理有 bug 会导致 CSS 加载失败 */
    cssCodeSplit: false,
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
