import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import path from 'path'

export default defineConfig({
  // Monorepo: load VITE_* from repo root .env(.local) so optional integrations
  // can be enabled for the built UI bundle used by the web dev server.
  envDir: resolve(__dirname, '../..'),
  plugins: [vue()],
  resolve: {
    alias: {
      '@ui': path.resolve(__dirname, '../ui')
    }
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PromptOptimizerUI',
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
      formats: ['es', 'cjs']
    },
    watch: process.env.NODE_ENV === 'development' ? {
      // 更精确的监听配置
      include: ['src/**/*'],
      buildDelay: 100
    } : null,
    // 🇨🇳 R52.20:生产构建关 sourcemap,减少 30MB+ 体积
    //  开发模式保留,方便调试;生产不需要(用户 F12 也看不到源码更安全)
    sourcemap: process.env.NODE_ENV === 'development',
    rollupOptions: {
      external: ['vue', 'vue-router', '@prompt-optimizer/core', 'uuid'],
      output: {
        globals: {
          vue: 'Vue',
          'vue-router': 'VueRouter',
          '@prompt-optimizer/core': 'PromptOptimizerCore',
          'uuid': 'uuid'
        },
        assetFileNames: 'style.css'
      }
    },
    cssCodeSplit: false,
    // UI types are emitted in a separate build step after Vite finishes.
    emptyOutDir: true
  },
  assetsInclude: ['**/*.jpg', '**/*.jpeg', '**/*.png', '**/*.svg']
}) 
