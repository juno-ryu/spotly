import { describe, it, expect, vi, beforeEach } from "vitest";

// next/headers cookies()를 vi.mock으로 stub
type CookieRecord = { value: string };
type CookieSetOptions = {
  httpOnly?: boolean;
  sameSite?: "lax" | "strict" | "none";
  secure?: boolean;
  path?: string;
  maxAge?: number;
};

interface MockCookieStore {
  store: Map<string, CookieRecord>;
  setCalls: Array<{ name: string; value: string; options?: CookieSetOptions }>;
  deleteCalls: string[];
  get(name: string): CookieRecord | undefined;
  set(name: string, value: string, options?: CookieSetOptions): void;
  delete(name: string): void;
}

let mockCookieStore: MockCookieStore;

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mockCookieStore),
}));

import {
  readAnonymousId,
  getOrCreateAnonymousId,
  clearAnonymousId,
} from "@/server/anonymous/cookie";
import { ANON_COOKIE_NAME, ANON_TTL } from "@/server/anonymous/constants";

beforeEach(() => {
  mockCookieStore = {
    store: new Map(),
    setCalls: [],
    deleteCalls: [],
    get(name) {
      return this.store.get(name);
    },
    set(name, value, options) {
      this.store.set(name, { value });
      this.setCalls.push({ name, value, options });
    },
    delete(name) {
      this.store.delete(name);
      this.deleteCalls.push(name);
    },
  };
});

describe("readAnonymousId", () => {
  it("쿠키가 없으면 null을 반환한다", async () => {
    const result = await readAnonymousId();
    expect(result).toBeNull();
  });

  it("쿠키가 있으면 값을 반환한다", async () => {
    mockCookieStore.store.set(ANON_COOKIE_NAME, { value: "existing-id" });
    const result = await readAnonymousId();
    expect(result).toBe("existing-id");
  });
});

describe("getOrCreateAnonymousId", () => {
  it("기존 쿠키 값이 있으면 그대로 반환하고 set을 호출하지 않는다", async () => {
    mockCookieStore.store.set(ANON_COOKIE_NAME, { value: "existing-id" });

    const result = await getOrCreateAnonymousId();

    expect(result).toBe("existing-id");
    expect(mockCookieStore.setCalls).toHaveLength(0);
  });

  it("쿠키가 없으면 새 UUID를 발급하고 HTTP-only 쿠키로 set한다", async () => {
    const result = await getOrCreateAnonymousId();

    // UUID 형식 검증 (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    expect(result).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    expect(mockCookieStore.setCalls).toHaveLength(1);
    const call = mockCookieStore.setCalls[0];
    expect(call.name).toBe(ANON_COOKIE_NAME);
    expect(call.value).toBe(result);
    expect(call.options?.httpOnly).toBe(true);
    expect(call.options?.sameSite).toBe("lax");
    expect(call.options?.path).toBe("/");
    expect(call.options?.maxAge).toBe(ANON_TTL.seconds);
  });
});

describe("clearAnonymousId", () => {
  it("쿠키를 delete 호출로 제거한다", async () => {
    mockCookieStore.store.set(ANON_COOKIE_NAME, { value: "existing-id" });

    await clearAnonymousId();

    expect(mockCookieStore.deleteCalls).toContain(ANON_COOKIE_NAME);
    expect(mockCookieStore.store.has(ANON_COOKIE_NAME)).toBe(false);
  });
});
