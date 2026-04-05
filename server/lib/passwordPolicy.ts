/**
 * Shared password rules for signup and reset (server-side).
 */

export function validatePasswordPolicy(password: string): string | null {
  if (password.length < 8) {
    return "パスワードは8文字以上で入力してください。";
  }
  if (!/(?=.*[A-Za-z])(?=.*\d)/.test(password)) {
    return "パスワードは英字と数字をそれぞれ1文字以上含めてください。";
  }
  return null;
}
