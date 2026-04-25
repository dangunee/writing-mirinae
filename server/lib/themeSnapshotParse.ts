/**
 * writing.sessions.theme_snapshot may be plain text (legacy) or JSON with
 * { title, theme, prompt, requirements[], modelAnswer, ... }.
 */

export type ThemeRequirementItem = {
  grammarLevel?: string;
  expressionLabel?: string;
  pattern?: string;
  translationJa?: string;
  exampleKo?: string;
};

export type ParsedThemeSnapshot = {
  title: string | null;
  theme: string | null;
  prompt: string | null;
  requirementItems: ThemeRequirementItem[];
  /** modelAnswer string embedded in the theme_snapshot JSON, if any. */
  modelAnswerFromThemeJson: string | null;
};

/**
 * @param raw - column value from theme_snapshot (or null)
 * @returns null if empty; otherwise structured fields (legacy plain text → theme only).
 */
export function parseThemeSnapshot(raw: string | null | undefined): ParsedThemeSnapshot | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (s === "") return null;
  if (s.startsWith("{")) {
    try {
      const o = JSON.parse(s) as Record<string, unknown>;
      if (o && typeof o === "object" && !Array.isArray(o)) {
        const requirementItems: ThemeRequirementItem[] = [];
        const reqRaw = o.requirements;
        if (Array.isArray(reqRaw)) {
          for (const item of reqRaw) {
            if (item == null || typeof item !== "object" || Array.isArray(item)) continue;
            const r = item as Record<string, unknown>;
            requirementItems.push({
              grammarLevel: typeof r.grammarLevel === "string" ? r.grammarLevel : undefined,
              expressionLabel: typeof r.expressionLabel === "string" ? r.expressionLabel : undefined,
              pattern: typeof r.pattern === "string" ? r.pattern : undefined,
              translationJa: typeof r.translationJa === "string" ? r.translationJa : undefined,
              exampleKo: typeof r.exampleKo === "string" ? r.exampleKo : undefined,
            });
          }
        }
        return {
          title: typeof o.title === "string" && o.title.trim() !== "" ? o.title : null,
          theme: typeof o.theme === "string" && o.theme.trim() !== "" ? o.theme : null,
          prompt: typeof o.prompt === "string" && o.prompt.trim() !== "" ? o.prompt : null,
          requirementItems,
          modelAnswerFromThemeJson:
            typeof o.modelAnswer === "string" && o.modelAnswer.trim() !== "" ? o.modelAnswer.trim() : null,
        };
      }
    } catch {
      // fall through: treat as plain text theme line
    }
  }
  return {
    title: null,
    theme: s,
    prompt: null,
    requirementItems: [],
    modelAnswerFromThemeJson: null,
  };
}
