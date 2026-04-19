/**
 * 作文提出の利用経路（trial / regular mail link / 正規ログイン / admin QA sandbox）
 */
export type AccessContext =
  | { type: 'trial' }
  | { type: 'regular' }
  | { type: 'student' }
  | { type: 'admin_sandbox'; mode: 'trial' | 'regular' | 'academy' }
