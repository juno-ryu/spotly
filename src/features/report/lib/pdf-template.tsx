import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { AiReport } from "../schema";
import { formatRadius } from "@/lib/format";
import type { ScoreBreakdown } from "@/features/analysis/schema";
import type { GolmokAggregated } from "@/server/data-sources/seoul-golmok-client";
import {
  getIndicatorGrades,
  GRADE_PDF_COLOR,
} from "@/features/analysis/lib/grade";

// 한글 폰트 등록 (Noto Sans KR - @react-pdf는 .ttf만 지원)
Font.register({
  family: "NotoSansKR",
  fonts: [
    {
      src: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-kr@latest/korean-400-normal.ttf",
      fontWeight: "normal",
    },
    {
      src: "https://cdn.jsdelivr.net/fontsource/fonts/noto-sans-kr@latest/korean-700-normal.ttf",
      fontWeight: "bold",
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    fontFamily: "NotoSansKR",
    padding: 40,
    fontSize: 10,
    color: "#1a1a1a",
  },
  header: {
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: "#3b82f6",
    paddingBottom: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "#666",
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#3b82f6",
  },
  scoreBox: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#f0f9ff",
    borderRadius: 6,
    marginBottom: 12,
  },
  scoreItem: {
    alignItems: "center",
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: "bold",
  },
  scoreLabel: {
    fontSize: 8,
    color: "#666",
    marginTop: 2,
  },
  verdictBox: {
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
    alignItems: "center",
  },
  verdict: {
    fontSize: 16,
    fontWeight: "bold",
  },
  listItem: {
    flexDirection: "row",
    marginBottom: 4,
    paddingLeft: 8,
  },
  bullet: {
    width: 12,
    fontSize: 10,
  },
  listText: {
    flex: 1,
    lineHeight: 1.5,
  },
  detailedText: {
    lineHeight: 1.6,
    textAlign: "justify",
  },
  golmokBox: {
    padding: 10,
    backgroundColor: "#fef3c7",
    borderRadius: 6,
    marginBottom: 12,
  },
  golmokTitle: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 6,
    color: "#92400e",
  },
  golmokRow: {
    flexDirection: "row" as const,
    justifyContent: "space-between" as const,
    marginBottom: 3,
  },
  golmokLabel: {
    fontSize: 9,
    color: "#78350f",
  },
  golmokValue: {
    fontSize: 9,
    fontWeight: "bold" as const,
    color: "#451a03",
  },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: "#999",
    borderTopWidth: 1,
    borderTopColor: "#eee",
    paddingTop: 8,
  },
});

/** 판정 결과별 배경색 */
const VERDICT_BG: Record<string, string> = {
  "추천": "#dcfce7",
  "조건부 추천": "#fef3c7",
  "주의": "#fed7aa",
  "비추천": "#fecaca",
};

const VERDICT_COLOR: Record<string, string> = {
  "추천": "#166534",
  "조건부 추천": "#92400e",
  "주의": "#9a3412",
  "비추천": "#991b1b",
};

const SCORE_INDICATORS = [
  { key: "vitality" as const, label: "활력도" },
  { key: "competition" as const, label: "경쟁" },
  { key: "survival" as const, label: "생존" },
  { key: "residential" as const, label: "주거" },
  { key: "income" as const, label: "소득" },
] as const;

/** PDF 점수 섹션 — 종합 점수 + 지표별 등급/퍼센트 */
function ScoreSection({
  totalScore,
  scoreDetail,
}: {
  totalScore: number;
  scoreDetail: Record<string, number>;
}) {
  const grades = getIndicatorGrades(scoreDetail as ScoreBreakdown);

  return (
    <View style={styles.scoreBox}>
      <View style={styles.scoreItem}>
        <Text style={styles.scoreValue}>{totalScore}</Text>
        <Text style={styles.scoreLabel}>종합</Text>
      </View>
      {SCORE_INDICATORS.map(({ key, label }) => {
        const info = grades[key];
        return (
          <View key={key} style={styles.scoreItem}>
            <Text
              style={[styles.scoreValue, { color: GRADE_PDF_COLOR[info.grade] }]}
            >
              {info.grade}
            </Text>
            <Text style={styles.scoreLabel}>
              {label} {info.percent}%
            </Text>
          </View>
        );
      })}
    </View>
  );
}

interface AnalysisReportPDFProps {
  address: string;
  industryName: string;
  radius: number;
  totalScore: number | null;
  scoreDetail: Record<string, number> | null;
  report: AiReport;
  createdAt: string;
  golmok?: GolmokAggregated;
}

/** PDF 리포트 레이아웃 */
export function AnalysisReportPDF({
  address,
  industryName,
  radius,
  totalScore,
  scoreDetail,
  report,
  createdAt,
  golmok,
}: AnalysisReportPDFProps) {
  const radiusLabel = formatRadius(radius);
  const dateStr = new Date(createdAt).toLocaleDateString("ko-KR");

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.title}>상권 분석 리포트</Text>
          <Text style={styles.subtitle}>
            {address} · {industryName} · 반경 {radiusLabel}
          </Text>
          <Text style={styles.subtitle}>분석일: {dateStr}</Text>
        </View>

        {/* 종합 판정 */}
        <View
          style={[
            styles.verdictBox,
            { backgroundColor: VERDICT_BG[report.verdict] ?? "#f3f4f6" },
          ]}
        >
          <Text
            style={[
              styles.verdict,
              { color: VERDICT_COLOR[report.verdict] ?? "#1a1a1a" },
            ]}
          >
            {report.verdict}
          </Text>
          <Text style={{ marginTop: 4, textAlign: "center" }}>
            {report.summary}
          </Text>
        </View>

        {/* 점수 */}
        {totalScore != null && scoreDetail && (
          <ScoreSection totalScore={totalScore} scoreDetail={scoreDetail} />
        )}

        {/* 골목상권 요약 (서울 한정) */}
        {golmok && (
          <View style={styles.golmokBox}>
            <Text style={styles.golmokTitle}>
              골목상권 분석 (서울시 빅데이터)
            </Text>
            <View style={styles.golmokRow}>
              <Text style={styles.golmokLabel}>추정매출</Text>
              <Text style={styles.golmokValue}>
                {(golmok.estimatedQuarterlySales / 10000).toLocaleString()}만원/분기
              </Text>
            </View>
            <View style={styles.golmokRow}>
              <Text style={styles.golmokLabel}>매출 피크</Text>
              <Text style={styles.golmokValue}>
                {golmok.peakDay} {golmok.peakTimeSlot}
              </Text>
            </View>
            <View style={styles.golmokRow}>
              <Text style={styles.golmokLabel}>주 소비층</Text>
              <Text style={styles.golmokValue}>
                {golmok.mainAgeGroup} {golmok.mainGender}
              </Text>
            </View>
            <View style={styles.golmokRow}>
              <Text style={styles.golmokLabel}>점포</Text>
              <Text style={styles.golmokValue}>
                {golmok.storeCount}개 (프랜차이즈 {golmok.franchiseCount}개)
              </Text>
            </View>
            <View style={styles.golmokRow}>
              <Text style={styles.golmokLabel}>개/폐업률</Text>
              <Text style={styles.golmokValue}>
                {golmok.openRate}% / {golmok.closeRate}%
              </Text>
            </View>
            {golmok.changeIndexName && (
              <View style={styles.golmokRow}>
                <Text style={styles.golmokLabel}>상권 변화</Text>
                <Text style={styles.golmokValue}>
                  {golmok.changeIndex}({golmok.changeIndexName})
                </Text>
              </View>
            )}
          </View>
        )}

        {/* 강점 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>강점</Text>
          {report.strengths.map((s, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>{s}</Text>
            </View>
          ))}
        </View>

        {/* 위험 요소 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>위험 요소</Text>
          {report.risks.map((r, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>{r}</Text>
            </View>
          ))}
        </View>

        {/* 제언 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>제언</Text>
          {report.recommendations.map((r, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>{r}</Text>
            </View>
          ))}
        </View>

        {/* 상세 분석 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>상세 분석</Text>
          <Text style={styles.detailedText}>
            {report.detailedAnalysis}
          </Text>
        </View>

        {/* 푸터 */}
        <View style={styles.footer} fixed>
          <Text>창업 분석기 - AI 상권 분석 리포트</Text>
          <Text>본 리포트는 공공 데이터 기반 참고 자료입니다.</Text>
        </View>
      </Page>
    </Document>
  );
}
