"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { POPULAR_INDUSTRIES } from "@/constants/enums/industry-type";

interface IndustrySelectorProps {
  value: { code: string; name: string } | null;
  onChange: (industry: { code: string; name: string }) => void;
}

export function IndustrySelector({ value, onChange }: IndustrySelectorProps) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? POPULAR_INDUSTRIES.filter(
        (i) =>
          i.name.includes(search) ||
          i.keywords.some((k) => k.includes(search)),
      )
    : POPULAR_INDUSTRIES;

  return (
    <div className="space-y-3">
      <Label>업종 선택</Label>
      <Input
        placeholder="업종명 검색 (예: 치킨, 커피, 미용)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        {filtered.map((industry) => (
          <Badge
            key={industry.code}
            variant={value?.code === industry.code ? "default" : "outline"}
            className="cursor-pointer text-sm py-1.5 px-3"
            onClick={() =>
              onChange({ code: industry.code, name: industry.name })
            }
          >
            {industry.name}
          </Badge>
        ))}
      </div>
      {value && (
        <p className="text-sm text-muted-foreground">
          선택됨: <span className="font-medium text-foreground">{value.name}</span>
        </p>
      )}
    </div>
  );
}
