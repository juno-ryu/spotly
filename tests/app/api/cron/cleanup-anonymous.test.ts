import { describe, it, expect, vi, beforeEach } from "vitest";

// repository를 mock해서 실제 DB 호출 차단 — vi.hoisted로 hoisting 안전
const { deleteExpiredAnonymousMock } = vi.hoisted(() => ({
  deleteExpiredAnonymousMock: vi.fn(async () => 0),
}));
vi.mock("@/server/anonymous/repository", () => ({
  deleteExpiredAnonymous: deleteExpiredAnonymousMock,
}));

import { GET } from "@/app/api/cron/cleanup-anonymous/route";

beforeEach(() => {
  deleteExpiredAnonymousMock.mockClear();
  deleteExpiredAnonymousMock.mockResolvedValue(0);
  delete process.env.CRON_SECRET;
});

function buildRequest(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader) headers.set("authorization", authHeader);
  return new Request("http://localhost/api/cron/cleanup-anonymous", { headers });
}

describe("GET /api/cron/cleanup-anonymous", () => {
  it("CRON_SECRET 미설정 시 500을 반환한다 (Bearer undefined 우회 차단)", async () => {
    const res = await GET(buildRequest("Bearer anything"));
    expect(res.status).toBe(500);
    expect(deleteExpiredAnonymousMock).not.toHaveBeenCalled();
  });

  it("Authorization 헤더가 없으면 401을 반환한다", async () => {
    process.env.CRON_SECRET = "secret-value";
    const res = await GET(buildRequest());
    expect(res.status).toBe(401);
    expect(deleteExpiredAnonymousMock).not.toHaveBeenCalled();
  });

  it("Authorization 헤더가 불일치하면 401을 반환한다", async () => {
    process.env.CRON_SECRET = "secret-value";
    const res = await GET(buildRequest("Bearer wrong"));
    expect(res.status).toBe(401);
    expect(deleteExpiredAnonymousMock).not.toHaveBeenCalled();
  });

  it("정상 인증 시 200과 deleted 카운트를 반환한다", async () => {
    process.env.CRON_SECRET = "secret-value";
    deleteExpiredAnonymousMock.mockResolvedValue(3);

    const res = await GET(buildRequest("Bearer secret-value"));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true, deleted: 3 });
    expect(deleteExpiredAnonymousMock).toHaveBeenCalledOnce();
  });
});
