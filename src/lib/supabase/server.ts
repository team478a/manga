import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { hasSupabaseEnv } from "@/lib/env";

export async function createClient() {
  if (!hasSupabaseEnv()) {
    throw new Error("Supabaseの環境変数が設定されていません。.env.local を確認してください。");
  }

  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot always set cookies. Middleware can be added later if needed.
          }
        }
      }
    }
  );
}
