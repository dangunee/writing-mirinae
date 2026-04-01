/** API ベース（Vercel 等で API が別オリジンの場合は VITE_API_BASE_URL を設定） */
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`
}
