/**
 * 作文提出の利用経路（trial / regular mail link / 正規ログイン）
 */
export type AccessContext = { type: 'trial' } | { type: 'regular' } | { type: 'student' }
