import { describe, it, expect, vi, beforeEach } from "vitest";
import { PrismockClient } from "prismock";
import dayjs from "dayjs";

// prismock의 PrismaClient mock으로 src/server/db/prisma.ts를 교체
vi.mock("@/server/db/prisma", () => {
  const client = new PrismockClient();
  return { prisma: client };
});

import {
  createAnonymousAnalysis,
  migrateAnonymousToUser,
  deleteExpiredAnonymous,
} from "@/server/anonymous/repository";
import { prisma } from "@/server/db/prisma";
import { ANON_TTL } from "@/server/anonymous/constants";

beforeEach(async () => {
  // 각 테스트마다 테이블 초기화
  await prisma.anonymousAnalysis.deleteMany({});
});

describe("createAnonymousAnalysis", () => {
  it("입력값으로 row를 생성하고 expiresAt을 7일 후로 설정한다", async () => {
    const before = dayjs().valueOf();
    const row = await createAnonymousAnalysis({
      anonymousId: "anon-1",
      address: "서울특별시 강남구 역삼동 123",
      industryName: "카페",
      totalScore: 78.5,
    });
    const after = dayjs().valueOf();

    expect(row.id).toBeTruthy();
    expect(row.expiresAt).not.toBeNull();
    const expiresMs = dayjs(row.expiresAt!).valueOf();
    const expectedMin = before + ANON_TTL.seconds * 1000;
    const expectedMax = after + ANON_TTL.seconds * 1000;
    expect(expiresMs).toBeGreaterThanOrEqual(expectedMin);
    expect(expiresMs).toBeLessThanOrEqual(expectedMax);
  });

  it("DB에 row가 anonymousId·userId=null·totalScore와 함께 저장된다", async () => {
    await createAnonymousAnalysis({
      anonymousId: "anon-1",
      address: "주소",
      industryName: "카페",
      totalScore: 80,
      lat: 37.5,
      lng: 127.0,
    });

    const found = await prisma.anonymousAnalysis.findFirst({
      where: { anonymousId: "anon-1" },
    });

    expect(found).not.toBeNull();
    expect(found!.userId).toBeNull();
    expect(found!.totalScore).toBe(80);
    expect(found!.lat).toBe(37.5);
    expect(found!.lng).toBe(127.0);
  });
});

describe("migrateAnonymousToUser", () => {
  beforeEach(async () => {
    await prisma.analysisReport.deleteMany({});
  });

  it("AnonymousAnalysis: userId가 null인 row의 userId를 채우고 expiresAt을 비운다", async () => {
    await prisma.anonymousAnalysis.create({
      data: {
        anonymousId: "anon-2",
        address: "주소",
        industryName: "카페",
        totalScore: 70,
        expiresAt: dayjs().add(1, "day").toDate(),
      },
    });

    const result = await migrateAnonymousToUser("anon-2", "user-xyz");

    expect(result.analysisCount).toBe(1);
    const row = await prisma.anonymousAnalysis.findFirst({
      where: { anonymousId: "anon-2" },
    });
    expect(row!.userId).toBe("user-xyz");
    expect(row!.expiresAt).toBeNull();
  });

  it("AnalysisReport: anonymousId 매칭 row의 userId를 채우고 anonymousId를 비운다", async () => {
    await prisma.analysisReport.create({
      data: {
        address: "주소",
        industryName: "카페",
        totalScore: 70,
        aiReportJson: { verdict: "test" },
        anonymousId: "anon-rep",
      },
    });

    const result = await migrateAnonymousToUser("anon-rep", "user-xyz");

    expect(result.reportCount).toBe(1);
    const row = await prisma.analysisReport.findFirst({
      where: { userId: "user-xyz" },
    });
    expect(row).not.toBeNull();
    expect(row!.anonymousId).toBeNull();
  });

  it("두 테이블 동시에 마이그레이션", async () => {
    await prisma.anonymousAnalysis.create({
      data: { anonymousId: "anon-both", address: "주소", industryName: "카페", totalScore: 70 },
    });
    await prisma.analysisReport.create({
      data: {
        address: "주소",
        industryName: "카페",
        totalScore: 70,
        aiReportJson: { verdict: "x" },
        anonymousId: "anon-both",
      },
    });

    const result = await migrateAnonymousToUser("anon-both", "user-xyz");

    expect(result.analysisCount).toBe(1);
    expect(result.reportCount).toBe(1);
  });

  it("매칭되는 row가 없으면 0/0을 반환한다", async () => {
    const result = await migrateAnonymousToUser("nonexistent", "user-xyz");
    expect(result.analysisCount).toBe(0);
    expect(result.reportCount).toBe(0);
  });

  it("두 번째 호출은 idempotent하게 0/0을 반환한다", async () => {
    await prisma.anonymousAnalysis.create({
      data: { anonymousId: "anon-3", address: "주소", industryName: "카페", totalScore: 70 },
    });

    const first = await migrateAnonymousToUser("anon-3", "user-xyz");
    const second = await migrateAnonymousToUser("anon-3", "user-xyz");

    expect(first.analysisCount).toBe(1);
    expect(second.analysisCount).toBe(0);
  });
});

describe("deleteExpiredAnonymous", () => {
  it("userId가 null이고 expiresAt이 과거인 row를 삭제한다", async () => {
    const past = dayjs().subtract(1, "day").toDate();
    const future = dayjs().add(1, "day").toDate();

    await prisma.anonymousAnalysis.create({
      data: {
        anonymousId: "expired",
        address: "주소",
        industryName: "카페",
        totalScore: 70,
        expiresAt: past,
      },
    });
    await prisma.anonymousAnalysis.create({
      data: {
        anonymousId: "still-valid",
        address: "주소",
        industryName: "카페",
        totalScore: 70,
        expiresAt: future,
      },
    });

    const deleted = await deleteExpiredAnonymous();

    expect(deleted).toBe(1);
    const remaining = await prisma.anonymousAnalysis.findMany({});
    expect(remaining).toHaveLength(1);
    expect(remaining[0].anonymousId).toBe("still-valid");
  });

  it("userId가 채워진 row는 expiresAt이 과거여도 보존한다 (가입 승계됨)", async () => {
    const past = dayjs().subtract(1, "day").toDate();
    await prisma.anonymousAnalysis.create({
      data: {
        anonymousId: "migrated",
        address: "주소",
        industryName: "카페",
        totalScore: 70,
        userId: "user-1",
        expiresAt: past,
      },
    });

    const deleted = await deleteExpiredAnonymous();

    expect(deleted).toBe(0);
    const remaining = await prisma.anonymousAnalysis.findMany({});
    expect(remaining).toHaveLength(1);
  });
});
