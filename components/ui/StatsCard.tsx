import { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  hint?: string;
  accent?: "amber" | "green" | "red" | "blue" | "gray";
}

const ACCENT_MAP: Record<string, string> = {
  amber: "text-amber-700 bg-amber-50",
  green: "text-green-700 bg-green-50",
  red: "text-red-600 bg-red-50",
  blue: "text-blue-700 bg-blue-50",
  gray: "text-gray-700 bg-gray-100",
};

export function StatsCard({
  title,
  value,
  icon: Icon,
  hint,
  accent = "amber",
}: StatsCardProps) {
  const text = String(value);
  // 金额位数多时自动降一档字号，避免在窄卡片里被截断
  const valueSize =
    text.length > 13 ? "text-lg" : text.length > 10 ? "text-xl" : "text-2xl";

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        {Icon && (
          <div
            className={cn(
              "flex h-12 w-12 items-center justify-center rounded-lg",
              ACCENT_MAP[accent]
            )}
          >
            <Icon className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm text-gray-500">{title}</p>
          <p
            className={cn("break-words font-bold text-gray-900", valueSize)}
            title={text}
          >
            {value}
          </p>
          {hint && <p className="text-xs text-gray-400">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
