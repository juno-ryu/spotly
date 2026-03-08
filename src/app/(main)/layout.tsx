import { createSupabaseServer } from "@/server/supabase/server";
import { LoginButton } from "@/features/auth/components/login-button";
import { UserMenu } from "@/features/auth/components/user-menu";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <>
      <div className="fixed top-0 right-0 z-50 p-3 pt-[calc(env(safe-area-inset-top)+8px)]">
        {user ? <UserMenu /> : <LoginButton />}
      </div>
      {children}
    </>
  );
}
