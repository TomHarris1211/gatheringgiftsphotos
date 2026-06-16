import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Auth-aware server client (reads the admin session from cookies).
// cookies() is async in Next 15+, so this helper is async too.
export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component; middleware refreshes the session
          }
        },
      },
    }
  );
}
