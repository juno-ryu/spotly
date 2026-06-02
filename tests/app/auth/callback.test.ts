import { describe, it, expect, vi, beforeEach } from "vitest";

const mocks = vi.hoisted(() => ({
  exchangeMock: vi.fn(),
  getUserMock: vi.fn(),
  readAnonymousIdMock: vi.fn(),
  clearAnonymousIdMock: vi.fn(),
  migrateAnonymousToUserMock: vi.fn(),
  cookieStoreMock: {
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => mocks.cookieStoreMock),
}));

vi.mock("@/server/supabase/server", () => ({
  createSupabaseServer: vi.fn(async () => ({
    auth: {
      exchangeCodeForSession: mocks.exchangeMock,
      getUser: mocks.getUserMock,
    },
  })),
}));

vi.mock("@/server/anonymous/cookie", () => ({
  readAnonymousId: mocks.readAnonymousIdMock,
  clearAnonymousId: mocks.clearAnonymousIdMock,
}));

vi.mock("@/server/anonymous/repository", () => ({
  migrateAnonymousToUser: mocks.migrateAnonymousToUserMock,
}));

import { GET } from "@/app/auth/callback/route";

function buildRequest(url: string): Request {
  return new Request(url, { headers: { host: "localhost:3000" } });
}

beforeEach(() => {
  mocks.exchangeMock.mockReset();
  mocks.getUserMock.mockReset();
  mocks.readAnonymousIdMock.mockReset();
  mocks.clearAnonymousIdMock.mockReset();
  mocks.migrateAnonymousToUserMock.mockReset();
  mocks.cookieStoreMock.get.mockReset();
  mocks.cookieStoreMock.delete.mockReset();
  mocks.cookieStoreMock.get.mockReturnValue(undefined);
});

describe("GET /auth/callback", () => {
  it("code 없을 때는 마이그레이션 호출 없이 /industry로 리다이렉트", async () => {
    const res = await GET(buildRequest("http://localhost:3000/auth/callback"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/industry");
    expect(mocks.exchangeMock).not.toHaveBeenCalled();
    expect(mocks.migrateAnonymousToUserMock).not.toHaveBeenCalled();
  });

  it("code 있고 익명 쿠키 없으면 exchange만 하고 마이그레이션 안 함", async () => {
    mocks.exchangeMock.mockResolvedValue({});
    mocks.getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.readAnonymousIdMock.mockResolvedValue(null);

    const res = await GET(buildRequest("http://localhost:3000/auth/callback?code=abc"));

    expect(res.status).toBe(307);
    expect(mocks.exchangeMock).toHaveBeenCalledWith("abc");
    expect(mocks.migrateAnonymousToUserMock).not.toHaveBeenCalled();
    expect(mocks.clearAnonymousIdMock).not.toHaveBeenCalled();
  });

  it("code 있고 익명 쿠키 있으면 exchange + migrate + clear 수행", async () => {
    mocks.exchangeMock.mockResolvedValue({});
    mocks.getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.readAnonymousIdMock.mockResolvedValue("anon-uuid-1");
    mocks.migrateAnonymousToUserMock.mockResolvedValue({ analysisCount: 1, reportCount: 0 });

    const res = await GET(buildRequest("http://localhost:3000/auth/callback?code=abc"));

    expect(res.status).toBe(307);
    expect(mocks.exchangeMock).toHaveBeenCalledWith("abc");
    expect(mocks.migrateAnonymousToUserMock).toHaveBeenCalledWith("anon-uuid-1", "user-1");
    expect(mocks.clearAnonymousIdMock).toHaveBeenCalledOnce();
  });

  it("마이그레이션 실패해도 가입 자체는 성공 (best-effort)", async () => {
    mocks.exchangeMock.mockResolvedValue({});
    mocks.getUserMock.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.readAnonymousIdMock.mockResolvedValue("anon-uuid-1");
    mocks.migrateAnonymousToUserMock.mockRejectedValue(new Error("DB down"));

    // 예외 throw 없이 redirect까지 도달해야 함
    const res = await GET(buildRequest("http://localhost:3000/auth/callback?code=abc"));

    expect(res.status).toBe(307);
    expect(mocks.exchangeMock).toHaveBeenCalled();
  });

  it("returnTo 쿠키가 있으면 해당 경로로 리다이렉트", async () => {
    mocks.exchangeMock.mockResolvedValue({});
    mocks.getUserMock.mockResolvedValue({ data: { user: null } });
    mocks.readAnonymousIdMock.mockResolvedValue(null);
    mocks.cookieStoreMock.get.mockImplementation((name: string) =>
      name === "auth_return_to" ? { value: "/analyze?lat=37.5" } : undefined,
    );

    const res = await GET(buildRequest("http://localhost:3000/auth/callback?code=abc"));

    expect(res.headers.get("location")).toContain("/analyze?lat=37.5");
    expect(mocks.cookieStoreMock.delete).toHaveBeenCalledWith("auth_return_to");
  });
});
