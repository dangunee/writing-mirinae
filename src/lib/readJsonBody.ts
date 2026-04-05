/**
 * Parse fetch Response JSON without throwing (empty body, HTML error pages, invalid JSON).
 */
export async function readJsonBody<T>(res: Response): Promise<T | null> {
  const text = await res.text()
  if (!text.trim()) return null
  try {
    return JSON.parse(text) as T
  } catch {
    return null
  }
}
