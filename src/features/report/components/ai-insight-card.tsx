"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AiInsightCardProps {
  title: string;
  items: string[];
  variant?: "default" | "positive" | "negative";
}

const VARIANT_STYLES = {
  default: "border-border",
  positive: "border-green-500/30 bg-green-500/5",
  negative: "border-red-500/30 bg-red-500/5",
};

export function AiInsightCard({
  title,
  items,
  variant = "default",
}: AiInsightCardProps) {
  return (
    <Card className={VARIANT_STYLES[variant]}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="text-sm flex gap-2">
              <span className="text-muted-foreground shrink-0">
                {variant === "positive" ? "+" : variant === "negative" ? "!" : "-"}
              </span>
              {item}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
