import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as kakaoGeocoding from "@/server/data-sources/kakao-geocoding";

const querySchema = z.object({
  address: z.string().trim().min(1),
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    address: searchParams.get("address"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "주소를 입력해주세요" },
      { status: 400 },
    );
  }

  const coord = await kakaoGeocoding.addressToCoord(parsed.data.address);

  if (!coord) {
    return NextResponse.json(
      { error: "주소를 찾을 수 없습니다" },
      { status: 404 },
    );
  }

  const region = await kakaoGeocoding.coordToRegion(
    coord.latitude,
    coord.longitude,
  );

  return NextResponse.json({
    ...coord,
    region,
  });
}
