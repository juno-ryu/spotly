import { GENERATION_STEPS } from "@/features/analysis/constants/generation-steps";

/**
 * Fold 7 — GeneratingProgress 시각 재현.
 *
 * 사이드이펙트 0: setInterval / setState 없음.
 * 각 step 은 spinner → check 로 전환되는 CSS @keyframes 무한 루프.
 * 스피너와 체크는 절대 동시에 보이지 않음 (동일 타이밍의 inverse opacity).
 */

/** 각 step 의 진행 phase 가 차지하는 사이클 비율(%). stepDelayStep / cycleDuration */
const STEP_PHASE_PERCENT = 100 / GENERATION_STEPS.length;
/** step 별 delay (초). 사이클 안에서 어느 시점에 활성화되는지 */
const STEP_DELAY_SECONDS = 2.5;
const CYCLE_DURATION = `${GENERATION_STEPS.length * STEP_DELAY_SECONDS}s`;

export function GeneratingPreview() {
  return (
    <div
      className="absolute inset-0 z-[100] bg-background flex flex-col items-center justify-center px-8 pointer-events-none select-none"
      aria-hidden
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
@keyframes preview-progress {
  0% { width: 0%; }
  85%, 100% { width: 95%; }
}
/* spinner: 0~phase% 보임(처리중), phase%~100% 완전 숨김(체크가 표시됨) */
@keyframes preview-spinner-vis {
  0% { opacity: 0.4; }
  ${(STEP_PHASE_PERCENT * 0.6).toFixed(2)}% { opacity: 1; }
  ${STEP_PHASE_PERCENT.toFixed(2)}%, 100% { opacity: 0; }
}
/* check: 0~phase% 숨김, phase%부터 보임 */
@keyframes preview-check-vis {
  0%, ${(STEP_PHASE_PERCENT - 0.01).toFixed(2)}% { opacity: 0; }
  ${STEP_PHASE_PERCENT.toFixed(2)}%, 100% { opacity: 1; }
}
`,
        }}
      />

      <div className="w-full max-w-[300px] space-y-6">
        <div className="text-center space-y-2">
          <p className="text-lg font-bold">AI 전문가가 분석 중이에요</p>
          <p className="text-sm text-muted-foreground">
            수집된 데이터를 기반으로 맞춤 리포트를 작성하고 있어요
          </p>
        </div>

        {/* 프로그레스 바 — CSS 무한 루프 */}
        <div className="space-y-2">
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-violet-500"
              style={{
                animation: `preview-progress ${CYCLE_DURATION} ease-out infinite`,
              }}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">분석 중...</p>
            <p className="text-xs font-medium text-violet-500">진행</p>
          </div>
        </div>

        {/* 전체 단계 — 각 step 의 delay 에 따라 spinner → check 전환 */}
        <div className="space-y-2.5">
          {GENERATION_STEPS.map((label, i) => {
            const delay = `${i * STEP_DELAY_SECONDS}s`;
            return (
              <div key={label} className="flex items-center gap-2.5 text-sm">
                <span className="w-4 h-4 flex items-center justify-center shrink-0 relative">
                  {/* 진행 중 spinner — phase 종료 시 사라짐 */}
                  <span
                    className="absolute w-3.5 h-3.5 rounded-full border-2 border-violet-500 border-t-transparent"
                    style={{
                      animation: `spin 1s linear infinite, preview-spinner-vis ${CYCLE_DURATION} linear infinite`,
                      animationDelay: `0s, ${delay}`,
                    }}
                  />
                  {/* 완료 체크 — phase 종료 후 등장 */}
                  <span
                    className="absolute text-emerald-500 text-xs font-bold"
                    style={{
                      animation: `preview-check-vis ${CYCLE_DURATION} linear infinite`,
                      animationDelay: delay,
                    }}
                  >
                    ✓
                  </span>
                </span>
                <span className="text-foreground/80">{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
