"use client";

export default function MainTemplate({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="animate-in fade-in duration-200">{children}</div>;
}
