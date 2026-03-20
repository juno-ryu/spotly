export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "분석 이력",
  description: "내가 분석한 창업 입지 리포트 이력을 확인하세요.",
  robots: { index: false },
};
import { prisma } from "@/server/db/prisma";
import { BackButton } from "@/components/back-button";
import { createSupabaseServer } from "@/server/supabase/server";
import dayjs from "dayjs";

export default async function HistoryPage() {
  const supabase = await createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const reports = await prisma.analysisReport.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      address: true,
      industryName: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-4 px-6 pt-16 pb-6">
      {/* <BackButton /> */}
      <h1 className="text-2xl font-bold">AI 리포트 이력</h1>

      {reports.length === 0 ? (
        <p className="text-muted-foreground">
          아직 생성된 리포트가 없습니다.
        </p>
      ) : (
        <ul className="space-y-2">
          {reports.map((r) => (
            <li key={r.id}>
              <Link
                href={`/report/${r.id}`}
                className="flex items-center justify-between rounded-xl border p-4 hover:bg-accent transition-colors"
              >
                <div>
                  <p className="font-medium">{r.address}</p>
                  <p className="text-sm text-muted-foreground">{r.industryName}</p>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-4">
                  {dayjs(r.createdAt).format("YYYY.MM.DD")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
