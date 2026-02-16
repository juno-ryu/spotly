"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { IndustrySelector } from "./industry-selector";
import { RadiusSelector } from "./radius-selector";
import { RadiusOption } from "@/constants/enums/radius-option";

export function AnalysisForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [address, setAddress] = useState("");
  const [industry, setIndustry] = useState<{
    code: string;
    name: string;
  } | null>(null);
  const [radius, setRadius] = useState<RadiusOption>(RadiusOption.MEDIUM);
  const [coords, setCoords] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  /** 주소 검색 → 좌표 변환 */
  async function handleAddressSearch() {
    if (!address.trim()) {
      toast.error("주소를 입력해주세요");
      return;
    }

    try {
      const res = await fetch(
        `/api/geocode?address=${encodeURIComponent(address)}`,
      );
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "주소를 찾을 수 없습니다");
        return;
      }

      setCoords({ latitude: data.latitude, longitude: data.longitude });
      toast.success(
        `${data.region.region1} ${data.region.region2} ${data.region.region3}`,
      );
    } catch {
      toast.error("주소 검색 중 오류가 발생했습니다");
    }
  }

  /** 분석 실행 */
  async function handleSubmit() {
    if (!coords) {
      toast.error("주소를 검색하여 위치를 확인해주세요");
      return;
    }
    if (!industry) {
      toast.error("업종을 선택해주세요");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address,
          industryCode: industry.code,
          industryName: industry.name,
          radius,
          latitude: coords.latitude,
          longitude: coords.longitude,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error("분석 요청 실패");
        return;
      }

      // router.push(`/analyze/${data.id}`);
    } catch {
      toast.error("분석 요청 중 오류가 발생했습니다");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>창업 입지 분석</CardTitle>
        <CardDescription>
          주소, 업종, 분석 반경을 설정하고 분석을 시작하세요.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 주소 입력 */}
        <div className="space-y-2">
          <Label htmlFor="address">주소</Label>
          <div className="flex gap-2">
            <Input
              id="address"
              placeholder="예: 서울시 강남구 역삼동"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAddressSearch();
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={handleAddressSearch}
            >
              검색
            </Button>
          </div>
          {coords && (
            <p className="text-xs text-muted-foreground">
              좌표: {coords.latitude.toFixed(6)}, {coords.longitude.toFixed(6)}
            </p>
          )}
        </div>

        {/* 업종 선택 */}
        <IndustrySelector value={industry} onChange={setIndustry} />

        {/* 반경 선택 */}
        <RadiusSelector value={radius} onChange={setRadius} />

        {/* 분석 시작 */}
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting || !coords || !industry}
          className="w-full"
          size="lg"
        >
          {isSubmitting ? "분석 중..." : "분석 시작"}
        </Button>
      </CardContent>
    </Card>
  );
}
