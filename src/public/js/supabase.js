import { createClient } from "@supabase/supabase-js";

const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.ENV ?? {};

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("SUPABASE_URL o SUPABASE_ANON_KEY no están configuradas.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
