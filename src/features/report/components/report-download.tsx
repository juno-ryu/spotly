"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ReportDownloadProps {
  analysisId: string;
}

/** PDF 다운로드 버튼 */
export function ReportDownload({ analysisId }: ReportDownloadProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch(`/api/report/${analysisId}/pdf`);
      if (!res.ok) {
        const error = await res.json();
        alert(error.error ?? "PDF 생성에 실패했습니다.");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `analysis-${analysisId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert("PDF 다운로드 중 오류가 발생했습니다.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Button
      variant="outline"
      onClick={handleDownload}
      disabled={isDownloading}
    >
      {isDownloading ? "PDF 생성 중..." : "PDF 다운로드"}
    </Button>
  );
}
