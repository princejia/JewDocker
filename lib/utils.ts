import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 格式化金额为人民币字符串，如 ¥1,200.00 */
export function formatCurrency(value: number | null | undefined): string {
  const n = Number(value ?? 0);
  return `¥${n.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** 格式化日期为 YYYY-MM-DD */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

/** 格式化日期时间为 YYYY-MM-DD HH:mm */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

/** 由 YYYY-MM 得到下个月 1 号（YYYY-MM-DD），用于半开区间的按月筛选 */
export function nextMonthStart(month: string): string {
  const [y, m] = month.split("-").map(Number);
  const year = m === 12 ? y + 1 : y;
  const next = m === 12 ? 1 : m + 1;
  return `${year}-${String(next).padStart(2, "0")}-01`;
}

/**
 * 生成产品/裸石编号：前缀 + 年月日时分秒（取自创建时间）。
 * 产品以 P 开头，裸石以 L 开头。
 */
export function formatProductCode(
  prefix: "P" | "L",
  createdAt: string | null | undefined
): string {
  if (!createdAt) return prefix;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return prefix;
  const pad = (x: number) => String(x).padStart(2, "0");
  return `${prefix}${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(
    d.getDate()
  )}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}
