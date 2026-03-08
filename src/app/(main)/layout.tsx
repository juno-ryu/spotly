import { createSupabaseServer } from "@/server/supabase/server";
import { UserMenu } from "@/features/auth/components/user-menu";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  const avatarUrl = user?.user_metadata?.avatar_url as string | undefined;
  const name = user?.user_metadata?.full_name as string | undefined;

  return (
    <>
      {user && (
        <div className="fixed top-0 right-0 z-50 p-3 pt-[calc(env(safe-area-inset-top)+8px)]">
          <UserMenu
            email={user.email ?? ""}
            avatarUrl={avatarUrl}
            name={name}
          />
        </div>
      )}
      {children}
    </>
  );
}
