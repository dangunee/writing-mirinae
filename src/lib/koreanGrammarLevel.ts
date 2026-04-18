/** 한국어 문법 난이도 (과제 요건 슬롯·관리 UI 공통). 서버와 동기화 유지. */
export const KOREAN_GRAMMAR_LEVELS_JA = ['初級', '初中級', '中級', '中上級', '上級'] as const

export type KoreanGrammarLevelJa = (typeof KOREAN_GRAMMAR_LEVELS_JA)[number]

export const DEFAULT_KOREAN_GRAMMAR_LEVEL_JA: KoreanGrammarLevelJa = '中級'

export function isKoreanGrammarLevelJa(s: string): s is KoreanGrammarLevelJa {
  return (KOREAN_GRAMMAR_LEVELS_JA as readonly string[]).includes(s)
}
