/**
 * Structured assignment JSON stored in writing.sessions.theme_snapshot (text column holds JSON string).
 * Legacy: plain text "title\n\nprompt" or with 要件 block — see parseThemeSnapshotText.
 */

export type AssignmentRequirement = {
  expressionKey: string;
  expressionLabel: string;
  pattern: string;
  translationJa: string;
  exampleKo: string;
};

export type ThemeSnapshotV1 = {
  theme: string;
  title: string;
  prompt: string;
  requirements: AssignmentRequirement[];
  modelAnswer?: string;
};

export type GrammarCheckResultStored = {
  checkedAt: string;
  results: Array<{
    expressionKey: string;
    expressionLabel: string;
    pattern: string;
    matched: boolean;
  }>;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isRequirement(v: unknown): v is AssignmentRequirement {
  if (!isRecord(v)) return false;
  const keys = ["expressionKey", "expressionLabel", "pattern", "translationJa", "exampleKo"] as const;
  for (const k of keys) {
    const x = v[k];
    if (typeof x !== "string") return false;
  }
  return true;
}

/** Parse theme_snapshot: JSON ThemeSnapshotV1, or legacy plain text. */
export function parseThemeSnapshotText(raw: string | null | undefined): {
  structured: ThemeSnapshotV1 | null;
  legacyTitle: string | null;
  legacyInstruction: string;
} {
  if (raw == null || !String(raw).trim()) {
    return { structured: null, legacyTitle: null, legacyInstruction: "" };
  }
  const trimmed = String(raw).trim();
  if (trimmed.startsWith("{")) {
    try {
      const j = JSON.parse(trimmed) as unknown;
      if (!isRecord(j)) return fallbackLegacy(trimmed);
      const theme = typeof j.theme === "string" ? j.theme : "";
      const title = typeof j.title === "string" ? j.title : "";
      const prompt = typeof j.prompt === "string" ? j.prompt : "";
      const modelAnswer = typeof j.modelAnswer === "string" ? j.modelAnswer : undefined;
      const reqRaw = j.requirements;
      const requirements: AssignmentRequirement[] = [];
      if (Array.isArray(reqRaw)) {
        for (const r of reqRaw) {
          if (isRequirement(r)) requirements.push(r);
        }
      }
      if (!title && !prompt && requirements.length === 0) {
        return fallbackLegacy(trimmed);
      }
      return {
        structured: {
          theme: theme || title || "",
          title: title || theme || "",
          prompt,
          requirements,
          modelAnswer,
        },
        legacyTitle: null,
        legacyInstruction: "",
      };
    } catch {
      return fallbackLegacy(trimmed);
    }
  }
  return fallbackLegacy(trimmed);
}

function fallbackLegacy(trimmed: string): {
  structured: null;
  legacyTitle: string | null;
  legacyInstruction: string;
} {
  const parts = trimmed.split(/\n\n/);
  const legacyTitle = parts[0]?.trim() || null;
  const legacyInstruction = parts.length > 1 ? parts.slice(1).join("\n\n").trim() : "";
  return {
    structured: null,
    legacyTitle,
    legacyInstruction: legacyInstruction || trimmed,
  };
}

function normalizeForMatch(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Deterministic substring check (server-side only). */
export function runGrammarUsageCheck(
  bodyText: string | null | undefined,
  requirements: AssignmentRequirement[]
): GrammarCheckResultStored {
  const checkedAt = new Date().toISOString();
  const body = bodyText ?? "";
  const normBody = normalizeForMatch(body);
  const results = requirements.map((r) => {
    const p = normalizeForMatch(r.pattern);
    const matched = p.length > 0 && normBody.includes(p);
    return {
      expressionKey: r.expressionKey,
      expressionLabel: r.expressionLabel,
      pattern: r.pattern,
      matched,
    };
  });
  return { checkedAt, results };
}

export function grammarCheckFromSessionSnapshot(
  themeSnapshot: string | null | undefined,
  bodyText: string | null | undefined
): GrammarCheckResultStored | null {
  const parsed = parseThemeSnapshotText(themeSnapshot);
  const reqs = parsed.structured?.requirements ?? [];
  if (reqs.length === 0) {
    return { checkedAt: new Date().toISOString(), results: [] };
  }
  return runGrammarUsageCheck(bodyText, reqs);
}
