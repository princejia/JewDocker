import {
  LayoutDashboard,
  Gem,
  Diamond,
  Receipt,
  FileText,
  Users,
  BarChart3,
  ArrowLeftRight,
  Recycle,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { MENUS } from "@/lib/menus";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const ICONS: Record<string, LucideIcon> = {
  "/": LayoutDashboard,
  "/products": Gem,
  "/loose-stones": Diamond,
  "/quotes": FileText,
  "/sales": Receipt,
  "/loans": ArrowLeftRight,
  "/recycles": Recycle,
  "/customers": Users,
  "/reports": BarChart3,
  "/users": ShieldCheck,
};

// 菜单清单与权限体系共用 lib/menus.ts，这里只补充图标
export const NAV_ITEMS: NavItem[] = MENUS.map((m) => ({
  href: m.key,
  label: m.label,
  icon: ICONS[m.key] ?? LayoutDashboard,
}));
