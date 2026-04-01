/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string
  /** お問い合わせ CTA のリンク先（未設定時は mirinae.jp） */
  readonly VITE_INQUIRY_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
