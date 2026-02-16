export const dynamic = "force-dynamic";

import Link from "next/link";
import { prisma } from "@/server/db/prisma";
import { Badge } from "@/components/ui/badge";
import { BackButton } from "@/components/back-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getScoreLevel, SCORE_LEVEL_LABEL } from "@/constants/enums/score-level";
import { formatRadius } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "대기중",
  PROCESSING: "분석중",
  COMPLETED: "완료",
  FAILED: "실패",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "outline",
  PROCESSING: "secondary",
  COMPLETED: "default",
  FAILED: "destructive",
};

export default async function HistoryPage() {
  const analyses = await prisma.analysisRequest.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="space-y-4">
      <BackButton />
      <h1 className="text-2xl font-bold pl-14">분석 이력</h1>

      {analyses.length === 0 ? (
        <p className="text-muted-foreground">
          아직 분석 이력이 없습니다.{" "}
          <Link href="/analyze" className="underline">
            새 분석 시작하기
          </Link>
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>주소</TableHead>
              <TableHead>업종</TableHead>
              <TableHead>반경</TableHead>
              <TableHead>점수</TableHead>
              <TableHead>상태</TableHead>
              <TableHead>일시</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {analyses.map((a) => (
              <TableRow key={a.id}>
                <TableCell>
                  <Link
                    href={`/analyze/${a.id}`}
                    className="hover:underline font-medium"
                  >
                    {a.address}
                  </Link>
                </TableCell>
                <TableCell>{a.industryName}</TableCell>
                <TableCell>{formatRadius(a.radius)}</TableCell>
                <TableCell>
                  {a.totalScore != null ? (
                    <span className="font-bold">
                      {a.totalScore}점{" "}
                      <span className="text-xs text-muted-foreground">
                        ({SCORE_LEVEL_LABEL[getScoreLevel(a.totalScore)]})
                      </span>
                    </span>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[a.status] ?? "outline"}>
                    {STATUS_LABEL[a.status] ?? a.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">
                  {a.createdAt.toLocaleDateString("ko-KR")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
