"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SelectionChipProps {
  emoji: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
}

/** 온보딩 업종/지역 선택 칩 (radiogroup 패턴) */
export function SelectionChip({
  emoji,
  label,
  selected,
  onSelect,
}: SelectionChipProps) {
  return (
    <Button
      variant="outline"
      role="radio"
      aria-checked={selected}
      tabIndex={selected ? 0 : -1}
      onClick={onSelect}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-1.5",
        "h-[84px] rounded-xl border transition-all duration-150",
        "active:scale-95",
        selected && [
          "border-2 border-[var(--onboarding-chip-border-selected)]",
          "bg-[var(--onboarding-chip-selected)]",
          "scale-[1.02]",
        ],
        !selected && "border-border bg-secondary hover:bg-accent",
      )}
    >
      <span className="text-[28px] leading-none" aria-hidden>
        {emoji}
      </span>
      <span className="text-[13px] font-medium leading-none">{label}</span>
    </Button>
  );
}
