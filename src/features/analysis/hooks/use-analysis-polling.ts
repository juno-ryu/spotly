"use client";

import { useQuery } from "@tanstack/react-query";

async function fetchAnalysisStatus(id: string) {
  const res = await fetch(`/api/analyze/${id}`);
  if (!res.ok) throw new Error("분석 조회 실패");
  return res.json();
}

/** 분석 진행 상태 폴링 (2초 간격, 완료/실패 시 중지) */
export function useAnalysisPolling(analysisId: string) {
  return useQuery({
    queryKey: ["analysis", analysisId],
    queryFn: () => fetchAnalysisStatus(analysisId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "COMPLETED" || status === "FAILED" ? false : 2000;
    },
  });
}
