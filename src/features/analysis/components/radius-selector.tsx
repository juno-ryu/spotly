"use client";

import { Label } from "@/components/ui/label";
import { RADIUS_OPTIONS, type RadiusOption } from "@/constants/enums/radius-option";

interface RadiusSelectorProps {
  value: RadiusOption;
  onChange: (radius: RadiusOption) => void;
}

export function RadiusSelector({ value, onChange }: RadiusSelectorProps) {
  return (
    <div className="space-y-3">
      <Label>분석 반경</Label>
      <div className="flex gap-3">
        {RADIUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-lg border p-3 text-center transition-colors ${
              value === option.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:bg-accent"
            }`}
          >
            <div className="font-bold">{option.label}</div>
            <div className="text-xs text-muted-foreground">
              {option.description}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
