import { describe, it, expect, vi, beforeEach } from "vitest";

// Upstash Redis 수동 mock — Map 기반 in-memory + TTL 옵션 캡처
interface RedisSetCall {
  key: string;
  value: string;
  options?: { ex?: number };
}

interface MockRedis {
  store: Map<string, string>;
  setCalls: RedisSetCall[];
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { ex?: number }): Promise<"OK">;
}

let mockRedis: MockRedis | null = null;

vi.mock("@/server/cache/redis", () => ({
  get redis() {
    return mockRedis;
  },
}));

import {
  isAnonymousQuotaUsed,
  markAnonymousQuotaUsed,
} from "@/server/anonymous/quota";
import { ANON_QUOTA_KEY, ANON_TTL } from "@/server/anonymous/constants";

function createMockRedis(): MockRedis {
  return {
    store: new Map(),
    setCalls: [],
    async get(key) {
      return this.store.get(key) ?? null;
    },
    async set(key, value, options) {
      this.store.set(key, value);
      this.setCalls.push({ key, value, options });
      return "OK";
    },
  };
}

beforeEach(() => {
  mockRedis = createMockRedis();
});

describe("isAnonymousQuotaUsed", () => {
  it("Redis 클라이언트가 null이면 false (개발 환경 친화)", async () => {
    mockRedis = null;
    const result = await isAnonymousQuotaUsed("any-id");
    expect(result).toBe(false);
  });

  it("키가 없으면 false", async () => {
    const result = await isAnonymousQuotaUsed("not-used-id");
    expect(result).toBe(false);
  });

  it("키가 있으면 true", async () => {
    mockRedis!.store.set(ANON_QUOTA_KEY("used-id"), "1");
    const result = await isAnonymousQuotaUsed("used-id");
    expect(result).toBe(true);
  });
});

describe("markAnonymousQuotaUsed", () => {
  it("Redis 클라이언트가 null이면 no-op (예외 없음)", async () => {
    mockRedis = null;
    await expect(markAnonymousQuotaUsed("any-id")).resolves.toBeUndefined();
  });

  it("set을 호출하며 EX 옵션에 7일 초를 넣는다", async () => {
    await markAnonymousQuotaUsed("new-id");

    expect(mockRedis!.setCalls).toHaveLength(1);
    const call = mockRedis!.setCalls[0];
    expect(call.key).toBe(ANON_QUOTA_KEY("new-id"));
    expect(call.value).toBe("1");
    expect(call.options?.ex).toBe(ANON_TTL.seconds);
  });

  it("호출 후 isAnonymousQuotaUsed가 true가 된다 (E2E 검증)", async () => {
    await markAnonymousQuotaUsed("e2e-id");
    const result = await isAnonymousQuotaUsed("e2e-id");
    expect(result).toBe(true);
  });
});
