import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig({
  root: __dirname, // vueWrapper 디렉토리를 root로 설정
  base: './',
  plugins: [
    vue(),
    viteSingleFile(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  build: {
    outDir: fileURLToPath(new URL('../.vite/renderer/main_window', import.meta.url)),
    emptyOutDir: true,
  },
  server: {
    port: 5173, // vueWrapper의 dev server 포트
  },
})
