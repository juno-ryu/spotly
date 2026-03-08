"use client";

import { WifiOff, RefreshCw, History } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
        <WifiOff className="h-10 w-10 text-muted-foreground" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">인터넷 연결이 없습니다</h1>
        <p className="text-sm text-muted-foreground">
          네트워크 연결을 확인한 후 다시 시도해 주세요.
          <br />
          이전에 열람한 분석 리포트는 오프라인에서도 확인할 수 있습니다.
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="default" onClick={() => window.location.reload()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          다시 시도
        </Button>
        <Button variant="outline" asChild>
          <Link href="/history">
            <History className="mr-2 h-4 w-4" />
            이력 보기
          </Link>
        </Button>
      </div>
    </div>
  );
}
