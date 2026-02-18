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
import {
  GRADE_PDF_COLOR,
  type IndicatorGrade,
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
    justifyContent: "center",
    gap: 24,
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

/** PDF 점수 섹션 — 2지표 독립 등급 */
function ScoreSection({ scoreDetail }: { scoreDetail: ScoreBreakdown }) {
  const items: { label: string; grade: string; score: number }[] = [
    {
      label: "경쟁 강도",
      grade: scoreDetail.competition.grade,
      score: scoreDetail.competition.score,
    },
  ];

  if (scoreDetail.vitality) {
    items.push({
      label: "상권 활력",
      grade: scoreDetail.vitality.grade,
      score: scoreDetail.vitality.score,
    });
  }

  return (
    <View style={styles.scoreBox}>
      {items.map(({ label, grade, score }) => (
        <View key={label} style={styles.scoreItem}>
          <Text
            style={[
              styles.scoreValue,
              { color: GRADE_PDF_COLOR[grade as IndicatorGrade] ?? "#1a1a1a" },
            ]}
          >
            {grade}
          </Text>
          <Text style={styles.scoreLabel}>
            {label} {score}점
          </Text>
        </View>
      ))}
    </View>
  );
}

interface AnalysisReportPDFProps {
  address: string;
  industryName: string;
  radius: number;
  scoreDetail: ScoreBreakdown | null;
  report: AiReport;
  createdAt: string;
}

/** PDF 리포트 레이아웃 */
export function AnalysisReportPDF({
  address,
  industryName,
  radius,
  scoreDetail,
  report,
  createdAt,
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
        {scoreDetail && <ScoreSection scoreDetail={scoreDetail} />}

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
