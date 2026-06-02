import { describe, it, expect } from "vitest";
import {
  ANON_COOKIE_NAME,
  ANON_TTL,
  ANON_QUOTA_KEY,
} from "@/server/anonymous/constants";

describe("ANON_COOKIE_NAME", () => {
  it("'spotly_anon_id'로 고정", () => {
    expect(ANON_COOKIE_NAME).toBe("spotly_anon_id");
  });
});

describe("ANON_TTL", () => {
  it("seconds는 7일(초)", () => {
    expect(ANON_TTL.seconds).toBe(7 * 24 * 60 * 60);
  });

  it("days는 7", () => {
    expect(ANON_TTL.days).toBe(7);
  });
});

describe("ANON_QUOTA_KEY", () => {
  it("anon:<id>:used 형식 키를 만든다", () => {
    expect(ANON_QUOTA_KEY("abc-123")).toBe("anon:abc-123:used");
  });

  it("빈 문자열 ID도 동작", () => {
    expect(ANON_QUOTA_KEY("")).toBe("anon::used");
  });
});
