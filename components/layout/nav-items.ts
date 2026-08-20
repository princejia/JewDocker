import {
  LayoutDashboard,
  Gem,
  Diamond,
  Receipt,
  Users,
  BarChart3,
  ArrowLeftRight,
  Recycle,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  superAdminOnly?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "仪表盘", icon: LayoutDashboard },
  { href: "/products", label: "产品管理", icon: Gem },
  { href: "/loose-stones", label: "裸石管理", icon: Diamond },
  { href: "/sales", label: "销售记录", icon: Receipt },
  { href: "/loans", label: "借调管理", icon: ArrowLeftRight },
  { href: "/recycles", label: "回收管理", icon: Recycle },
  { href: "/customers", label: "客户管理", icon: Users },
  { href: "/reports", label: "财务报表", icon: BarChart3 },
  { href: "/users", label: "账号管理", icon: ShieldCheck, superAdminOnly: true },
];
