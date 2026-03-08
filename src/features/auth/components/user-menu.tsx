import { createSupabaseServer } from "@/server/supabase/server";
import { signOut } from "../actions";

/** 로그인 상태 표시 + 로그아웃 (Server Component) */
export async function UserMenu() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const email = user.email ?? "";
  const avatarUrl = user.user_metadata?.avatar_url as string | undefined;
  const name = user.user_metadata?.full_name as string | undefined;

  return (
    <div className="flex items-center gap-3">
      {avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={avatarUrl} alt={name ?? email} className="w-7 h-7 rounded-full" />
      ) : (
        <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center text-xs font-medium text-violet-700">
          {email[0]?.toUpperCase()}
        </div>
      )}
      <form action={signOut}>
        <button type="submit" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          로그아웃
        </button>
      </form>
    </div>
  );
}
