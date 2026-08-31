"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function NoAccessPage() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-sm space-y-4 rounded-xl border bg-white p-8 text-center">
        <div className="text-4xl">🔒</div>
        <h1 className="text-lg font-semibold text-gray-900">暂无可访问的菜单</h1>
        <p className="text-sm text-gray-500">
          当前账号未被授予任何菜单权限，请联系管理员开通后再登录。
        </p>
        <Button variant="outline" onClick={handleLogout}>
          退出登录
        </Button>
      </div>
    </div>
  );
}
