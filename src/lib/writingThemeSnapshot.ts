/**
 * writing.sessions.theme_snapshot from admin assignment create:
 * title + "\n\n" + prompt + optional "\n\n要件:\n" + requirements
 */
export function parseThemeSnapshotForUi(raw: string | null | undefined): {
  title: string | null
  instruction: string
} {
  if (raw == null || !String(raw).trim()) {
    return { title: null, instruction: '' }
  }
  const trimmed = String(raw).trim()
  const parts = trimmed.split(/\n\n/)
  const title = parts[0]?.trim() || null
  const instruction = parts.length > 1 ? parts.slice(1).join('\n\n').trim() : ''
  return {
    title,
    instruction: instruction || trimmed,
  }
}
