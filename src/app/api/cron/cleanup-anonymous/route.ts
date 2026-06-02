import { NextResponse } from "next/server";
import { deleteExpiredAnonymous } from "@/server/anonymous/repository";

/**
 * Vercel Cron 호출 전용 — 만료된 미가입 익명 분석 row 삭제.
 * 일 1회 새벽 실행 (vercel.json crons 참조).
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  // 🚨 secret 미설정 가드 — `Bearer undefined` 비교 우회 차단
  if (!secret) {
    return new NextResponse("Cron secret not configured", { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const deleted = await deleteExpiredAnonymous();
  return NextResponse.json({ ok: true, deleted });
}

// 익명 row 삭제는 즉시 끝나지만 안전하게 30s
export const maxDuration = 30;
