/**
 * 作文提出の利用経路（将来: trial cookie / 正規ログインでサーバ検証と組み合わせる）
 */
export type AccessContext = { type: 'trial' } | { type: 'student' }
