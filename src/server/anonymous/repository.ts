import type { Prisma } from "@prisma/client";
import dayjs from "dayjs";
import { prisma } from "@/server/db/prisma";
import { ANON_TTL } from "./constants";

/** 익명 분석 row 생성 입력 */
export interface CreateAnonymousAnalysisInput {
  anonymousId: string;
  address: string;
  industryName: string;
  totalScore: number;
  scoreDetail?: Prisma.InputJsonValue;
  lat?: number;
  lng?: number;
}

/**
 * 익명 분석 row 생성 — `executeAnalysis()` 성공 직후 호출.
 * expiresAt은 현재 + 7일로 자동 설정.
 */
export async function createAnonymousAnalysis(input: CreateAnonymousAnalysisInput) {
  return prisma.anonymousAnalysis.create({
    data: {
      ...input,
      expiresAt: dayjs().add(ANON_TTL.days, "day").toDate(),
    },
    select: { id: true, expiresAt: true },
  });
}

/**
 * 가입 직후 호출 — 해당 익명 ID의 미가입 row를 두 테이블 모두 userId로 승계.
 *
 * - `AnonymousAnalysis`: userId 채우고 expiresAt NULL (cron 정리 대상에서 제외)
 * - `AnalysisReport`: userId 채우고 anonymousId NULL (가입 row로 전환)
 */
export async function migrateAnonymousToUser(
  anonymousId: string,
  userId: string,
): Promise<{ analysisCount: number; reportCount: number }> {
  const [analysisResult, reportResult] = await Promise.all([
    prisma.anonymousAnalysis.updateMany({
      where: { anonymousId, userId: null },
      data: { userId, expiresAt: null },
    }),
    prisma.analysisReport.updateMany({
      where: { anonymousId, userId: null },
      data: { userId, anonymousId: null },
    }),
  ]);
  return {
    analysisCount: analysisResult.count,
    reportCount: reportResult.count,
  };
}

/**
 * 만료된 미가입 익명 row 삭제 — cron에서 호출.
 * userId가 채워진 row(가입 승계됨)는 expiresAt이 과거여도 보존.
 *
 * @returns 삭제된 row 수
 */
export async function deleteExpiredAnonymous(): Promise<number> {
  const result = await prisma.anonymousAnalysis.deleteMany({
    where: {
      userId: null,
      expiresAt: { lt: dayjs().toDate() },
    },
  });
  return result.count;
}
