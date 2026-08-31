"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/components/layout/nav-items";

export function Sidebar() {
  const pathname = usePathname();
  // null 表示尚未取到权限，先不渲染，避免闪出无权访问的菜单
  const [menus, setMenus] = useState<string[] | null>(null);

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((j) => setMenus(j.user?.menus ?? []))
      .catch(() => setMenus([]));
  }, []);

  const items = menus
    ? NAV_ITEMS.filter((item) => menus.includes(item.href))
    : [];

  return (
    <aside className="hidden w-60 shrink-0 border-r bg-white md:flex md:flex-col">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <span className="text-2xl">💎</span>
        <span className="font-semibold text-amber-800">CF珠宝管理系统</span>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-amber-100 text-amber-900"
                  : "text-gray-600 hover:bg-gray-100"
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
