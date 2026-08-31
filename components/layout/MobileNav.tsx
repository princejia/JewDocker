"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/components/layout/nav-items";

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menus, setMenus] = useState<string[] | null>(null);

  // 路由切换后自动关闭抽屉
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
    <div className="md:hidden">
      <button
        type="button"
        aria-label="打开菜单"
        onClick={() => setOpen(true)}
        className="flex h-9 w-9 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          {/* 遮罩 */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          {/* 抽屉 */}
          <div className="absolute left-0 top-0 flex h-full w-64 flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b px-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">💎</span>
                <span className="font-semibold text-amber-800">
                  CF珠宝管理系统
                </span>
              </div>
              <button
                type="button"
                aria-label="关闭菜单"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
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
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
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
          </div>
        </div>
      )}
    </div>
  );
}
