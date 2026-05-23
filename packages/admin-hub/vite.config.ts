import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/__hub/',
  build: {
    outDir: 'dist',
  },
  server: {
    proxy: {
      '/__hub/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
