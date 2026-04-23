/**
 * API ベース URL の解決。
 *
 * **すべての `/api/...` は同一オリジン（相対パス）のみ。** writing-mirinae / Next Route Handlers
 * （`/api/auth/*`, `/api/writing/*`, `/api/teacher/*`, `/api/admin/*` など）はこのデプロイに存在する。
 * `VITE_API_BASE_URL`（例: mirinae-api.vercel.app）へ送ると 404 / Cookie 欠落で壊れる。
 *
 * `VITE_API_BASE_URL` は **`/api/` で始まらないパス** にだけ適用する（レガシー非 `/api` 用）。
 *
 * 体験決済など: `trialPaymentApiUrl` / `trialAdminBffApiUrl` も常に相対パス。
 */

function normalizePath(path: string): string {
  return path.startsWith('/') ? path : `/${path}`
}

function resolveApiUrl(path: string): string {
  const p = normalizePath(path)
  if (p === '/api' || p.startsWith('/api/')) {
    return p
  }
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

/** 体験決済・体験開始リンク専用: 必ず現在サイトの `/api/writing/trial-payment/...` または `/api/writing/trial/...`（Vercel `api/writing/...`）へ */
export function trialPaymentApiUrl(path: string): string {
  return normalizePath(path)
}

/**
 * 体験・銀行振込管理 BFF 専用。`VITE_API_BASE_URL` を無視し同一オリジンのみ。
 * ブラウザが mirinae-api を直接叩かないようにする（CORS / 秘密の流出防止）。
 */
export function trialAdminBffApiUrl(path: string): string {
  return normalizePath(path)
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
