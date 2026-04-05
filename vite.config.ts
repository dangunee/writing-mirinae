import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 기본 `/` — Vercel 루트 도메인(writing-mirinae.vercel.app 등)에서 자산 경로 일치
// mirinae.jp 의 /writing 서브패스에 올릴 때만 빌드 전 `VITE_BASE=/writing/` 설정
const base = process.env.VITE_BASE ?? '/'
if (!base.endsWith('/')) {
  throw new Error('VITE_BASE must end with / (e.g. /writing/)')
}

export default defineConfig({
  base,
  plugins: [react()],
  // [API 연결] Vite dev에서 Next `/api`로 프록시 (환경에 따라 `VITE_API_BASE_URL` 사용 가능)
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const host = req.headers?.host
            if (host) {
              proxyReq.setHeader('X-Forwarded-Host', host)
            }
            const proto =
              (req.headers?.['x-forwarded-proto'] as string | undefined) ||
              (req.socket && 'encrypted' in req.socket && req.socket.encrypted ? 'https' : 'http')
            proxyReq.setHeader('X-Forwarded-Proto', proto)
          })
        },
      },
    },
  },
})
