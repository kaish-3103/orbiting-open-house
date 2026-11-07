import { supabase } from "@/integrations/supabase/client";
import { bounded } from "@/lib/async-operation";
let pending: Promise<string> | null = null;
/** Returns the signed-in user id, creating a guest identity when there is none. */
export function ensureGuest(): Promise<string> {
  if (!pending) {
    // Keep the underlying attempt single-flight even after a UI timeout. A retry
    // waits for that same attempt rather than creating a second guest identity.
    const attempt = (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (data.user) return data.user.id;
      if (error && error.name !== "AuthSessionMissingError") throw new Error("Your session couldn't be checked. Check your connection and retry.");
      const { data: anon, error: authError } = await supabase.auth.signInAnonymously();
      if (authError || !anon.user) throw new Error("Guest sign-in failed. Check your connection and retry; if it continues, ask the host to check guest access.");
      return anon.user.id;
    })();
    pending = attempt;
    attempt.then(() => { if (pending === attempt) pending = null; }, () => { if (pending === attempt) pending = null; });
  }
  return bounded(pending, "Sign-in is taking too long. Check your connection and retry. If it continues, reload this page.");
}
