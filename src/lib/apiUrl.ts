/**
 * API ベース URL の解決。
 *
 * - `VITE_API_BASE_URL` があればそのオリジンに接続（別ドメインの API 用）。
 * - 未設定時は相対パス `/api/...`（開発: Vite proxy → Next、本番: 同一オリジンの Vercel Serverless `api/`）。
 *
 * 体験決済（trial-payment）は writing-mirinae 同一デプロイの `api/writing/trial-payment/*` を叩く必要がある。
 * `VITE_API_BASE_URL` が mirinae-api 等を指していると Next/Vercel 側のハンドラに届かないため、
 * `trialPaymentApiUrl` は常に相対パス（同一オリジン）を返す。
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

/** 体験決済専用: 必ず現在サイトの `/api/writing/trial-payment/...`（Vercel `api/writing/...`）へ */
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
