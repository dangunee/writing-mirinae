/**
 * API ベース URL の解決。
 *
 * - `VITE_API_BASE_URL` があればそのオリジンに接続（別ドメインの API 用）。
 * - 未設定時は相対パス `/api/...`（開発: Vite proxy → Next、本番: 同一オリジンの Vercel Serverless `api/`）。
 */

function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`
}

function resolveApiUrl(path: string): string {
  const p = normalizePath(path)
  const raw = import.meta.env.VITE_API_BASE_URL?.trim() ?? ''
  if (raw) {
    return `${raw.replace(/\/$/, '')}${p}`
  }
  return p
}

/** fetch 可能な API 解決先があるか（相対 `/api` 含む。常に true） */
export function isApiBaseConfigured(): boolean {
  return true
}

export function apiUrl(path: string): string {
  return resolveApiUrl(path)
}

/** 開発中のみ: 実際に fetch する URL をコンソールに出す */
export function logApiFetch(method: string, path: string): void {
  if (!import.meta.env.DEV) return
  try {
    console.debug(`[api] ${method} ${resolveApiUrl(path)}`)
  } catch {
    console.debug(`[api] ${method} ${normalizePath(path)} (VITE_API_BASE_URL missing in prod build)`)
  }
}
