import { supabase } from "@/integrations/supabase/client";
/** Returns the signed-in user id, creating a guest identity when there is none. */
export async function ensureGuest(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  if (data.user) return data.user.id;
  const { data: anon, error } = await supabase.auth.signInAnonymously();
  if (error || !anon.user) throw error ?? new Error("Could not start a guest session");
  return anon.user.id;
}
