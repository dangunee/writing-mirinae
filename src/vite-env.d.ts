/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string
  /** お問い合わせ CTA のリンク先（未設定時は mirinae.jp） */
  readonly VITE_INQUIRY_URL?: string
  /** Supabase browser client (PKCE / email confirmation code exchange on /writing/login) */
  readonly NEXT_PUBLIC_SUPABASE_URL?: string
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
