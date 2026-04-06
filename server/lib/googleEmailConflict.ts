import type { User } from "@supabase/supabase-js";

import { findUserIdWithEmailIdentityForEmail } from "./authIdentitiesLookup";
import { loginMethodsFromIdentities } from "./loginMethodsFromIdentities";

/**
 * After Google OAuth: block if another account already owns this email with email/password identity.
 * Never auto-merge; caller must sign out on conflict.
 */
export async function detectGoogleEmailConflict(user: User): Promise<boolean> {
  const email = user.email?.trim().toLowerCase();
  if (!email) return false;
  const lm = loginMethodsFromIdentities(user.identities);
  if (!lm.google) return false;
  const emailIdentityUserId = await findUserIdWithEmailIdentityForEmail(email);
  if (!emailIdentityUserId) return false;
  return emailIdentityUserId !== user.id;
}
