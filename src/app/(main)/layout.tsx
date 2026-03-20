import { createSupabaseServer } from "@/server/supabase/server";
import { LayoutButtons } from "@/components/layout-buttons";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <>
      <LayoutButtons
        isLoggedIn={!!user}
        email={user?.email ?? ""}
        avatarUrl={user?.user_metadata?.avatar_url as string | undefined}
        name={user?.user_metadata?.full_name as string | undefined}
      />
      {children}
    </>
  );
}
