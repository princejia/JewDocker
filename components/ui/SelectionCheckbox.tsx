"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** 自绘勾选框：不依赖原生 checkbox 渲染，可安全嵌在 <a> 内部 */
export function SelectionCheckbox({
  checked,
  onToggle,
  label,
  className,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  className?: string;
}) {
  function trigger(e: React.SyntheticEvent) {
    e.preventDefault();
    e.stopPropagation();
    onToggle();
  }

  return (
    <span
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      tabIndex={0}
      onClick={trigger}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") trigger(e);
      }}
      className={cn(
        "inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border transition-colors",
        checked
          ? "border-amber-600 bg-amber-600 text-white"
          : "border-gray-300 bg-white text-transparent hover:border-amber-400",
        className
      )}
    >
      <Check className="h-3.5 w-3.5" strokeWidth={3} />
    </span>
  );
}
