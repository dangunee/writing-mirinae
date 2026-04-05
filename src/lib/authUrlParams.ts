/**
 * Supabase may return auth params in `location.search` and/or `location.hash`
 * (e.g. #error=access_denied&error_code=otp_expired).
 */
export function mergeAuthParams(search: string, hash: string): URLSearchParams {
  const merged = new URLSearchParams()
  new URLSearchParams(search).forEach((v, k) => {
    merged.set(k, v)
  })
  const h = hash.startsWith('#') ? hash.slice(1) : hash
  if (h.trim()) {
    new URLSearchParams(h).forEach((v, k) => {
      merged.set(k, v)
    })
  }
  return merged
}

export type ParsedAuthUrlParams = {
  code: string | null
  error: string | null
  errorCode: string | null
}

export function parseAuthUrlParams(search: string, hash: string): ParsedAuthUrlParams {
  const merged = mergeAuthParams(search, hash)
  const code = merged.get('code')?.trim() ?? ''
  const error = merged.get('error')?.trim() ?? ''
  const errorCode = merged.get('error_code')?.trim() ?? ''
  return {
    code: code.length > 0 ? code : null,
    error: error.length > 0 ? error : null,
    errorCode: errorCode.length > 0 ? errorCode : null,
  }
}
