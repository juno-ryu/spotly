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
import { createSupabaseServer } from "@/server/supabase/server";
import { scoreToGrade } from "@/features/analysis/lib/scoring/types";
import { GRADE_HEX } from "@/features/analysis/lib/grade";
import { SITE_CONFIG } from "@/constants/site";
import { ShareButton } from "@/components/share-button";
import { HomeButton } from "@/components/home-button";
import { FloatingActionGroup } from "@/components/floating-action-group";
import type { AiReport } from "@/features/report/schema";
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
      totalScore: true,
      aiReportJson: true,
      createdAt: true,
    },
  });

  return (
    <div className="space-y-5 px-6 pt-16 pb-6">
      <div className="fixed top-16 right-4 z-50">
        <FloatingActionGroup>
          <HomeButton />
        </FloatingActionGroup>
      </div>
      <div>
        <h1 className="text-2xl font-bold">분석 이력</h1>
        <p className="text-sm text-muted-foreground mt-1">
          총 {reports.length}건의 분석 리포트
        </p>
      </div>

      {reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-4xl mb-3">📊</div>
          <p className="font-medium text-foreground">아직 분석 리포트가 없습니다</p>
          <p className="text-sm text-muted-foreground mt-1">
            창업 입지를 분석하면 이곳에 저장됩니다
          </p>
          <Link
            href="/"
            className="mt-4 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 transition-colors"
          >
            분석 시작하기
          </Link>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {reports.map((r) => {
            const { grade } = scoreToGrade(r.totalScore);
            const color = GRADE_HEX[grade as keyof typeof GRADE_HEX] ?? "#6b7280";
            const ai = r.aiReportJson as AiReport | null;

            const reportUrl = `${SITE_CONFIG.url}/report/${r.id}`;
            const shareTitle = `${r.address} ${r.industryName} ${grade}등급`;
            const shareText = ai?.verdict
              ? `AI 판정: ${ai.verdict}. 같이 창업 전에 확인해봐!`
              : "AI가 8개 공공데이터를 분석한 상권 리포트";

            return (
              <li key={r.id} className="flex items-start gap-0 rounded-xl border hover:bg-accent transition-colors">
                <Link
                  href={`/report/${r.id}`}
                  className="flex items-start gap-3.5 p-4 flex-1 min-w-0"
                >
                  {/* 등급 뱃지 */}
                  <div
                    className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0 mt-0.5"
                    style={{ backgroundColor: `${color}15` }}
                  >
                    <span className="text-lg font-black" style={{ color }}>
                      {grade}
                    </span>
                  </div>

                  {/* 주소 + 업종 + AI 한줄평 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{r.address}</p>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {dayjs(r.createdAt).format("MM.DD")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-muted-foreground">{r.industryName}</span>
                      {ai?.verdict && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${color}15`, color }}>
                          {ai.verdict}
                        </span>
                      )}
                    </div>
                    {ai?.summary && (
                      <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
                        {ai.summary}
                      </p>
                    )}
                  </div>
                </Link>
                {/* 공유 버튼 */}
                <div className="pr-3 pt-4 shrink-0">
                  <ShareButton
                    title={shareTitle}
                    text={shareText}
                    url={reportUrl}
                    size="sm"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
