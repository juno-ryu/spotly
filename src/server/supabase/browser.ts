import { createBrowserClient } from "@supabase/ssr";

/** Client Component에서 사용하는 싱글톤 클라이언트 */
export const supabaseBrowser = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
