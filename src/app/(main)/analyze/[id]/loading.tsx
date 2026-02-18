export default function AnalysisResultLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-dvh text-center px-4 space-y-4">
      <div className="mx-auto h-12 w-12 rounded-full bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center">
        <div className="h-5 w-5 rounded-full border-2 border-violet-600 border-t-transparent animate-spin" />
      </div>
      <h2 className="text-lg font-bold text-foreground">분석 진행 중...</h2>
      <p className="text-sm text-muted-foreground">
        공공 데이터를 수집하고 분석하고 있습니다
      </p>
    </div>
  );
}
