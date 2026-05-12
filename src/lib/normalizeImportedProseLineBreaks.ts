/**
 * Soft-wrap imported prose (PDF/CSV): single line breaks become spaces;
 * paragraph gaps (two or more consecutive newlines) stay as `\n\n`.
 * Use only for long-text fields (prompt, modelAnswer), not grammar examples.
 */
export function normalizeImportedProseLineBreaks(input: string): string {
  const s = String(input ?? '')
  if (!s.trim()) return s.trim() ? s : ''

  const normalized = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const paragraphs = normalized.split(/\n{2,}/)
  const out = paragraphs
    .map((p) => p.replace(/\n+/g, ' ').replace(/[ \t]+/g, ' ').trim())
    .filter((p) => p.length > 0)

  return out.join('\n\n')
}
