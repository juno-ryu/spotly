"use client";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ScoreBreakdown } from "@/features/analysis/schema";

interface InfrastructureInsightCardProps {
  body: string;
  infraAccess?: ScoreBreakdown["infraAccess"];
}

interface BodyRow {
  item: string;
  detail: string;
  rating: string;
}

/** "항목: 세부내용" 패턴으로 파싱 가능한지 확인 */
function tryParseTableRows(body: string): BodyRow[] | null {
  const lines = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // 줄이 2개 미만이거나, 대부분 콜론이 없으면 파싱 불가 처리
  const colonLines = lines.filter((l) => {
    const idx = l.indexOf(":");
    return idx > 0 && idx < 15;
  });
  if (lines.length < 2 || colonLines.length < lines.length * 0.5) return null;

  return lines.map((line) => {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0 && colonIdx < 15) {
      const item = line.slice(0, colonIdx).replace(/^[●\-·•]\s*/, "").trim();
      const rest = line.slice(colonIdx + 1).trim();
      return { item, detail: rest.replace(/[（(].*[）)]\s*$/, "").trim(), rating: extractRating(rest) };
    }
    const stripped = line.replace(/^[●\-·•]\s*/, "").trim();
    return { item: "—", detail: stripped, rating: extractRating(stripped) };
  });
}

/** 텍스트에서 평가 키워드 추출 */
function extractRating(text: string): string {
  if (/매우\s*좋|최상|우수|충분|풍부|많|편리|탁월/.test(text)) return "최상";
  if (/없|부족|불편|열악|낮|드물|제한/.test(text)) return "없음";
  return "보통";
}

/** 평가별 Badge 색상 */
function ratingBadgeClass(rating: string): string {
  switch (rating) {
    case "최상":
      return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400";
    case "없음":
      return "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400";
    default:
      return "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-400";
  }
}

/** body를 불릿 리스트로 포매팅 — 줄 단위 분리 */
function BodyAsList({ body }: { body: string }) {
  const lines = body
    .split("\n")
    .map((l) => l.replace(/^[●\-·•]\s*/, "").trim())
    .filter((l) => l.length > 0);

  if (lines.length <= 1) {
    return <p className="text-xs text-muted-foreground leading-relaxed">{body}</p>;
  }

  return (
    <ul className="space-y-1.5">
      {lines.map((line, i) => (
        <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
          <span className="mt-0.5 shrink-0 text-muted-foreground/50">●</span>
          <span className="leading-relaxed">{line}</span>
        </li>
      ))}
    </ul>
  );
}

/** 인프라 분석 카드 — 테이블 우선, 실패 시 불릿 리스트 */
export function InfrastructureInsightCard({
  body,
  infraAccess,
}: InfrastructureInsightCardProps) {
  const tableRows = tryParseTableRows(body);

  return (
    <div className="space-y-3">
      {/* 항목 테이블 (파싱 성공 시) 또는 불릿 리스트 */}
      {tableRows ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs w-1/5">항목</TableHead>
              <TableHead className="text-xs">세부 내용</TableHead>
              <TableHead className="text-xs text-right w-14">평가</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableRows.map((row, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs font-medium text-foreground/80 align-top">
                  {row.item}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-normal align-top">
                  {row.detail}
                </TableCell>
                <TableCell className="text-right align-top">
                  <Badge
                    variant="outline"
                    className={`text-[10px] px-1.5 py-0 ${ratingBadgeClass(row.rating)}`}
                  >
                    {row.rating}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <BodyAsList body={body} />
      )}
    </div>
  );
}
