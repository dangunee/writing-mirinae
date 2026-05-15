/**
 * Static marketing copy for /writing/intro — mirrors a real learner correction example
 * (提出文 / 添削ビュー / 清書 / 模範解答 / 講師メッセージ).
 */

export type IntroCorrectionReplaceSegment = {
  kind: 'replace'
  wrong: string
  right: string
  /** vocabulary (blue) vs grammar/style (green secondary) */
  tone?: 'vocab' | 'grammar'
}

export type IntroCorrectionSegment =
  | { kind: 'text'; value: string }
  | IntroCorrectionReplaceSegment

export const introCorrectionMarketingSample = {
  assignmentTitle: '世界情勢と日本社会',

  originalText: `내가 요즘에 관심이 가지고 있는 것은 세계상황이다.조금만전까지만 러시아와 우크라이나 이스라엘과 팔레스타인 그리고 최근에는 이란과 미국과의 대립이 늘어나고 있다.어제 미국 대통령님이 총에 맞은 뻔했다.전쟁으로 인해서 물가가 오르기 시작하고 있다.
일본에서 50대인 나를 포함해 전쟁을 모른다.이른바 평화에 취해 있다고 한다.젊은 사람들은 아이돌과 게임이나 애니메이션에 많은 관심이 있다.비현실적인 일에 관심이 많고 현실을 외면하고 있는 느낌이다.일하지 않고 집에만 있어도 생활할 수 있다.바로 죽을지도 모르는 두려움과 싸우는 나라의 사람들과의 온도 차가 크게 느껴진다.
한편에 첨단 기술 부문에서는 한국과 중국에 비해 크게 뒤쳐져 있다.워크 라이프 밸런스도 물론 중요하지만 세계 변화에 일본은 좀 더 민감하게 느끼고 대응해야 한다.그 것이 나라의 미래로 이어질것 같다.그러니까 위국의 뉴스도 보고 있다.`,

  /** 清書（最終確認）↔ 比較文（clean comparison text） */
  finalDraftText: `내가 요즘에 관심을 가지고 있는 것은 세계정세다. 얼마 전까지만 해도 러시아와 우크라이나 이스라엘과 팔레스타인 그리고 최근에는 이란과 미국과의 대립이 늘어나고 있다. 어제 미국 대통령님이 총에 맞을 뻔했다. 전쟁으로 인해서 물가가 오르기 시작하고 있다.

일본 사람들은 50대인 나를 포함해 전쟁을 모른다. 이른바 평화에 취해 있다고 한다. 젊은 사람들은 아이돌과 게임이나 애니메이션에 많은 관심이 있다. 비현실적인 일에 관심이 많고 현실을 외면하고 있는 느낌이다. 일하지 않고 집에만 있어도 생활할 수 있다. 바로 죽을지도 모르는 두려움과 싸우는 나라의 사람들과의 온도 차가 크게 느껴진다.

한편 첨단 기술 부문에서는 한국과 중국에 비해 크게 뒤쳐져 있다. 워크 라이프 밸런스도 물론 중요하지만 세계 변화에 일본은 좀 더 민감하게 느끼고 대응해야 한다. 그것이 나라의 미래로 이어질 수 있다. 그러니까 외국의 뉴스도 보고 있다.`,

  /** 模範解答 ↔ 模範文 */
  modelAnswerText: `내 취미는 운동이다. 몸을 움직이는 것을 좋아해서 어릴 때부터 운동을 많이 했다. 태권도, 축구, 야구, 수영 등 많은 운동을 했다. 그 중에서도 제일 처음 시작했던 운동은 수영이다. 3살 때부터 배우기 시작해서 중학교 때까지 했다. 수영은 자기와의 싸움이어서 기록을 경신할 때마다 기분이 좋았다. 하지만 고등학교 때부터는 공부할 과목이 너무 많아져서 운동을 못 하게 되었다. 그렇게 시간이 지나고 서른이 되었을 때, 몸이 갑자기 아파서 쓰러진 적이 있었다. 입원 생활은 매우 힘들었다. 그 때,평소의 생활 습관도 문제지만 운동 부족이라는 것을 알게 되어서 마라톤을 하기 시작했다. 마라톤을 시작한 지 벌써 3년이 되었다. 올해는 도쿄마라톤 대회에 나가 보려고 한다. 열심히 연습해서 꼭 완주하고 싶다.`,

  teacherMessageText: '잘 썼어요.',

  correctionParagraphs: [
    [
      { kind: 'text', value: '내가 요즘에 ' },
      { kind: 'replace', wrong: '관심이', right: '관심을', tone: 'grammar' },
      { kind: 'text', value: ' 가지고 있는 것은 ' },
      { kind: 'replace', wrong: '세계상황이다', right: '세계정세다', tone: 'vocab' },
      { kind: 'text', value: '.' },
      { kind: 'replace', wrong: '조금만전까지만', right: '얼마 전까지만 해도', tone: 'grammar' },
      { kind: 'text', value: ' 러시아와 우크라이나 이스라엘과 팔레스타인 그리고 최근에는 이란과 미국과의 대립이 늘어나고 있다.어제 미국 대통령님이 총에 ' },
      { kind: 'replace', wrong: '맞은', right: '맞을', tone: 'grammar' },
      { kind: 'text', value: ' 뻔했다.전쟁으로 인해서 물가가 오르기 시작하고 있다.' },
    ],
    [
      { kind: 'replace', wrong: '일본에서', right: '일본 사람들은', tone: 'grammar' },
      {
        kind: 'text',
        value:
          ' 50대인 나를 포함해 전쟁을 모른다.이른바 평화에 취해 있다고 한다.젊은 사람들은 아이돌과 게임이나 애니메이션에 많은 관심이 있다.비현실적인 일에 관심이 많고 현실을 외면하고 있는 느낌이다.일하지 않고 집에만 있어도 생활할 수 있다.바로 죽을지도 모르는 두려움과 싸우는 나라의 사람들과의 온도 차가 크게 느껴진다.',
      },
    ],
    [
      { kind: 'replace', wrong: '한편에', right: '한편', tone: 'grammar' },
      {
        kind: 'text',
        value:
          ' 첨단 기술 부문에서는 한국과 중국에 비해 크게 뒤쳐져 있다.워크 라이프 밸런스도 물론 중요하지만 세계 변화에 일본은 좀 더 민감하게 느끼고 대응해야 한다.',
      },
      { kind: 'text', value: ' ' },
      { kind: 'replace', wrong: '그 것이', right: '그것이', tone: 'grammar' },
      { kind: 'text', value: ' 나라의 미래로 ' },
      { kind: 'replace', wrong: '이어질것 같다', right: '이어질 수 있다', tone: 'grammar' },
      { kind: 'text', value: '.그러니까 ' },
      { kind: 'replace', wrong: '위국의', right: '외국의', tone: 'vocab' },
      { kind: 'text', value: ' 뉴스도 보고 있다.' },
    ],
  ] as IntroCorrectionSegment[][],

  sidebarFragments: [
    { category: '文法', wrong: '관심이', right: '관심을' },
    { category: '語彙', wrong: '세계상황이다', right: '세계정세다' },
    { category: '文法', wrong: '한편에', right: '한편' },
    { category: '語彙', wrong: '위국의', right: '외국의' },
  ] as const,
} as const

/** Rough 어절 count for the 単語数 badge (marketing static). */
export function introCorrectionFinalDraftWordCount(text: string): number {
  const normalized = text.replace(/\n+/g, ' ').trim()
  const bySpace = normalized.split(/\s+/).filter((w) => w.length > 0)
  if (bySpace.length >= 20) return bySpace.length
  return normalized
    .split(/(?<=[.!?])\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .reduce((sum, sent) => sum + Math.max(1, sent.split(/\s+/).filter(Boolean).length), 0)
}
