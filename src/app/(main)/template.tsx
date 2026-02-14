"use client";

export default function MainTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="animate-[page-fade-in_200ms_ease-out_both]">
      {children}
    </div>
  );
}
