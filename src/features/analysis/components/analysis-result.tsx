"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAnalysisPolling } from "../hooks/use-analysis-polling";
import { ScoreGauge } from "./score-gauge";
import { ScoreBreakdownChart } from "./score-breakdown";
import { BusinessTable } from "./business-table";
import { CompetitorMap } from "./competitor-map";
import { TrendChart } from "./trend-chart";
import { AnalysisSkeleton } from "./analysis-skeleton";
import { formatRadius } from "@/lib/format";

interface AnalysisResultProps {
  analysisId: string;
}

export function AnalysisResult({ analysisId }: AnalysisResultProps) {
  const { data, isLoading, error } = useAnalysisPolling(analysisId);

  if (isLoading) return <AnalysisSkeleton />;

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-destructive">분석 결과를 불러올 수 없습니다.</p>
          <Button variant="outline" className="mt-4" asChild>
            <Link href="/analyze">새 분석 시작</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  // 분석 진행 중
  if (data.status === "PENDING" || data.status === "PROCESSING") {
    return (
      <Card>
        <CardContent className="py-12 text-center space-y-4">
          <div className="animate-pulse text-4xl">🔍</div>
          <h2 className="text-xl font-bold">분석 진행 중...</h2>
          <p className="text-muted-foreground">
            공공 데이터를 수집하고 분석하고 있습니다. 잠시만 기다려주세요.
          </p>
          <Badge variant="secondary">
            {data.status === "PENDING" ? "대기중" : "분석중"}
          </Badge>
        </CardContent>
      </Card>
    );
  }

  // 분석 실패
  if (data.status === "FAILED") {
    return (
      <Card>
        <CardContent className="py-8 text-center space-y-4">
          <p className="text-destructive font-medium">분석에 실패했습니다.</p>
          <p className="text-sm text-muted-foreground">
            잠시 후 다시 시도해주세요.
          </p>
          <Button variant="outline" asChild>
            <Link href="/analyze">다시 시도</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  // 분석 완료
  const radiusLabel = formatRadius(data.radius);

  // reportData에서 사업장 데이터 추출
  const businesses = (data.reportData?.businesses as Array<{
    name: string;
    address: string;
    employeeCount: number;
    status: "active" | "suspended" | "closed";
    monthlyTrend: number[];
    latitude?: number;
    longitude?: number;
  }>) ?? [];

  // 좌표 정보 (reportData에 저장된 원래 요청 좌표 또는 첫 사업장 기준)
  const centerLat = data.reportData?.centerLatitude as number | undefined;
  const centerLng = data.reportData?.centerLongitude as number | undefined;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold">{data.address}</h1>
        <p className="text-muted-foreground">
          {data.industryName} · 반경 {radiusLabel} ·{" "}
          {new Date(data.createdAt).toLocaleDateString("ko-KR")}
        </p>
      </div>

      {/* 점수 섹션 */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>종합 점수</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            {data.totalScore != null && <ScoreGauge score={data.totalScore} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>항목별 점수</CardTitle>
            <CardDescription>5개 지표 기준 분석 결과</CardDescription>
          </CardHeader>
          <CardContent>
            {data.scoreDetail && (
              <ScoreBreakdownChart breakdown={data.scoreDetail} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* 탭 상세 */}
      <Tabs defaultValue="map">
        <TabsList>
          <TabsTrigger value="map">지도</TabsTrigger>
          <TabsTrigger value="trend">트렌드</TabsTrigger>
          <TabsTrigger value="businesses">사업장 목록</TabsTrigger>
          <TabsTrigger value="report">AI 리포트</TabsTrigger>
        </TabsList>

        {/* 지도 탭 */}
        <TabsContent value="map">
          <Card>
            <CardHeader>
              <CardTitle>경쟁업체 분포</CardTitle>
              <CardDescription>
                반경 {radiusLabel} 내 동일 업종 사업장 위치
              </CardDescription>
            </CardHeader>
            <CardContent>
              {centerLat && centerLng ? (
                <CompetitorMap
                  centerLat={centerLat}
                  centerLng={centerLng}
                  radius={data.radius}
                  businesses={businesses}
                />
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  지도 데이터가 없습니다.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 트렌드 탭 */}
        <TabsContent value="trend">
          <Card>
            <CardHeader>
              <CardTitle>직원 수 추이</CardTitle>
              <CardDescription>최근 12개월 주요 사업장 직원 수 변화</CardDescription>
            </CardHeader>
            <CardContent>
              <TrendChart businesses={businesses} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* 사업장 목록 탭 */}
        <TabsContent value="businesses">
          <Card>
            <CardHeader>
              <CardTitle>주변 사업장</CardTitle>
              <CardDescription>
                반경 {radiusLabel} 내 동일 업종 사업장 현황
              </CardDescription>
            </CardHeader>
            <CardContent>
              {businesses.length > 0 ? (
                <BusinessTable businesses={businesses} />
              ) : (
                <p className="text-muted-foreground">
                  사업장 데이터가 없습니다.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI 리포트 탭 */}
        <TabsContent value="report">
          <Card>
            <CardHeader>
              <CardTitle>AI 분석 리포트</CardTitle>
            </CardHeader>
            <CardContent>
              {data.aiSummary ? (
                <div className="space-y-4">
                  <p>{data.aiSummary}</p>
                  <Button variant="outline" asChild>
                    <Link href={`/report/${analysisId}`}>
                      전체 리포트 보기
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="text-center py-8 space-y-3">
                  <p className="text-muted-foreground">
                    아직 AI 리포트가 생성되지 않았습니다.
                  </p>
                  <Button variant="outline" asChild>
                    <Link href={`/report/${analysisId}`}>
                      AI 리포트 생성
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
