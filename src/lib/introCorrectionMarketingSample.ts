/**
 * Static copy for /writing/intro marketing preview (清書 / 模範解答 / 講師からのメッセージ).
 * Mirrors learner GET /api/writing/results/:submissionId correction fields shown on
 * /writing/app 「添削完了」 as 比較文 / 模範文 / 講師の一言.
 */
export const introCorrectionMarketingSample = {
  /** 清書（最終確認） ↔ correction.improvedText */
  finalDraftText: `도시 계획에서 인공지능이 맡는 역할은 본래부터 복잡한 과제였습니다. 그러나 최근 AI 기술의 도입은 그 전망을 크게 바꾸고 있습니다. 기존의 방식은 실시간 데이터 변화를 충분히 반영하지 못하는 경우가 많습니다. 예를 들어 교통 흐름을 시뮬레이션할 때, 정적인 모델은 통근자의 갑작스러운 이동 패턴의 변화를 예측하기 어렵습니다. 그 결과 도시의 자원 배분의 효율이 높아지고, 이는 밀집 지역에 사는 시민의 삶의 질 향상에 기여합니다.`,

  /** 模範解答 ↔ correction.modelAnswer */
  modelAnswerText: `도시 행정에서 인공지능의 전략적 통합은 실시간 데이터의 역동성을 반영하지 못하는 전통적 방법론의 한계를 극복하며, 궁극적으로 대도시 환경에서 거주민의 삶의 질을 제고하는 데 기여할 수 있습니다.`,

  /** 講師からのメッセージ ↔ correction.teacherComment */
  teacherMessageText:
    '語彙の選択と文のリズムが一段と洗練されました。次回は接続詞の多様化にも挑戦してみましょう。',
} as const
