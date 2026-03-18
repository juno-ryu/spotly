"use client";

export default function MainTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="animate-[page-fade-in_200ms_ease-out_both]">
      {children}
    </main>
  );
}
