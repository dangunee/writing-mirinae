/**
 * API ベース URL の解決。
 *
 * - 本番 (import.meta.env.PROD): `VITE_API_BASE_URL` 必須。未設定時は同一オリジンへの `/api/...` フォールバックは行わない。
 * - 開発 (Vite dev): 未設定時は相対パス `/api/...`（`vite.config.ts` の proxy → localhost:3000）。
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
  if (import.meta.env.DEV) {
    return p
  }
  throw new Error(
    '[apiUrl] VITE_API_BASE_URL is required in production builds (no same-origin /api fallback).'
  )
}

/** 本番で API ベースが設定されているか（開発では常に true） */
export function isApiBaseConfigured(): boolean {
  return import.meta.env.DEV || Boolean(import.meta.env.VITE_API_BASE_URL?.trim())
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
