import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // [API 연결] Vite dev에서 Next `/api`로 프록시 (환경에 따라 `VITE_API_BASE_URL` 사용 가능)
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
