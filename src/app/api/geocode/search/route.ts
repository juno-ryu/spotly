import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as kakaoGeocoding from "@/server/data-sources/kakao/client";

const querySchema = z.object({
  keyword: z.string().trim().min(1),
});

/** 키워드 기반 장소/주소 검색 (자동완성용) */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    keyword: searchParams.get("keyword"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "검색어를 입력해주세요" },
      { status: 400 },
    );
  }

  const { documents } = await kakaoGeocoding.searchByKeyword(parsed.data.keyword);

  return NextResponse.json({
    results: documents.slice(0, 10).map((r) => ({
      name: r.place_name,
      address: r.address_name,
      latitude: parseFloat(r.y),
      longitude: parseFloat(r.x),
      category: r.category_name,
    })),
  });
}
