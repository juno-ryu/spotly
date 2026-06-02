"use client";

import { useEffect, useRef } from "react";
import { trackEvent, AnalyticsEvent } from "@/lib/analytics";

interface ReviewViewTrackerProps {
  reportId: string;
  total: number;
}

/** IntersectionObserver 로 ReviewSection 이 뷰포트 진입 시 1회 발화 */
export function ReviewViewTracker({ reportId, total }: ReviewViewTrackerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const node = ref.current;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          trackEvent(AnalyticsEvent.REVIEW_VIEW, { reportId, total });
          io.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [reportId, total]);

  return <div ref={ref} aria-hidden className="h-px" />;
}
