"use client";

interface DetailedAnalysisTabsProps {
  detailedAnalysis: string;
  /** 종합 등급 색상 hex */
  gradeColor?: string;
}

/** 첫 문장과 나머지를 분리 */
function splitFirstSentence(text: string): { title: string; body: string } {
  const match = text.match(/^(.+?[.。!?！？])\s*/);
  if (match) {
    return { title: match[1], body: text.slice(match[0].length).trim() };
  }
  // 마침표 없으면 첫 30자를 제목으로
  const cut = text.slice(0, 30);
  return { title: cut, body: text.slice(cut.length).trim() };
}

/**
 * 상세 분석 — 문단별 카드 (왼쪽 액센트 바 + 소제목 + 본문)
 */
export function DetailedAnalysisTabs({
  detailedAnalysis,
  gradeColor = "#10b981",
}: DetailedAnalysisTabsProps) {
  const paragraphs = detailedAnalysis
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 10);

  if (paragraphs.length <= 1) {
    return (
      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
        {detailedAnalysis}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {paragraphs.map((p, i) => {
        const { title, body } = splitFirstSentence(p);
        return (
          <div
            key={i}
            className="rounded-lg border bg-card px-5 py-4"
            style={{ borderLeftWidth: 3, borderLeftColor: gradeColor }}
          >
            <p className="text-sm font-medium text-foreground leading-relaxed">
              {title}
            </p>
            {body && (
              <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                {body}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
