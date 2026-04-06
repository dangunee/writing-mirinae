import type { UserIdentity } from "@supabase/supabase-js";

export type LoginMethodsPayload = {
  email: boolean;
  google: boolean;
  line: boolean;
};

/**
 * Derive connected providers from Supabase session user.identities (never trust client).
 */
export function loginMethodsFromIdentities(identities: UserIdentity[] | undefined | null): LoginMethodsPayload {
  const set = new Set((identities ?? []).map((i) => i.provider));
  return {
    email: set.has("email"),
    google: set.has("google"),
    line: set.has("line"),
  };
}
