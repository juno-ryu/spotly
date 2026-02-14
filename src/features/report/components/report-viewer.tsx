"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { generateReport } from "../actions";
import { AiInsightCard } from "./ai-insight-card";
import { ReportDownload } from "./report-download";
import type { AiReport } from "../schema";

interface ReportViewerProps {
  analysisId: string;
  initialReport?: AiReport | null;
}

const VERDICT_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  "추천": "default",
  "조건부 추천": "secondary",
  "주의": "outline",
  "비추천": "destructive",
};

export function ReportViewer({ analysisId, initialReport }: ReportViewerProps) {
  const [report, setReport] = useState<AiReport | null>(initialReport ?? null);
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleGenerate() {
    setIsGenerating(true);
    try {
      const result = await generateReport(analysisId);
      if (result.success) {
        setReport(result.data as AiReport);
        toast.success("AI 리포트가 생성되었습니다");
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error("리포트 생성 중 오류가 발생했습니다");
    } finally {
      setIsGenerating(false);
    }
  }

  if (!report) {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <h2 className="text-xl font-bold">AI 분석 리포트</h2>
          <p className="text-muted-foreground">
            수집된 데이터를 AI가 종합 분석하여 강점, 위험 요소, 제언을 제공합니다.
          </p>
          <Button onClick={handleGenerate} disabled={isGenerating} size="lg">
            {isGenerating ? "리포트 생성 중..." : "AI 리포트 생성"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 종합 판단 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle>종합 판단</CardTitle>
            <Badge variant={VERDICT_VARIANT[report.verdict] ?? "outline"}>
              {report.verdict}
            </Badge>
          </div>
          <CardDescription>{report.summary}</CardDescription>
        </CardHeader>
      </Card>

      {/* 강점 / 위험 / 제언 */}
      <div className="grid gap-4 md:grid-cols-3">
        <AiInsightCard
          title="강점"
          items={report.strengths}
          variant="positive"
        />
        <AiInsightCard
          title="위험 요소"
          items={report.risks}
          variant="negative"
        />
        <AiInsightCard title="제언" items={report.recommendations} />
      </div>

      {/* 상세 분석 */}
      <Card>
        <CardHeader>
          <CardTitle>상세 분석</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-invert max-w-none text-sm leading-relaxed whitespace-pre-wrap">
            {report.detailedAnalysis}
          </div>
        </CardContent>
      </Card>

      {/* PDF 다운로드 */}
      <div className="flex justify-end">
        <ReportDownload analysisId={analysisId} />
      </div>
    </div>
  );
}
