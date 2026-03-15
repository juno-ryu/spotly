"use client";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ReportError({ error, reset }: ErrorProps) {
  return (
    <div className="py-12 text-center space-y-4 px-6">
      <h2 className="text-xl font-bold">리포트 생성에 실패했습니다</h2>
      <p className="text-muted-foreground text-sm">{error.message}</p>
      <button
        onClick={reset}
        className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        다시 시도
      </button>
    </div>
  );
}
