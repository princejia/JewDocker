import { resolveMenus } from "@/lib/menus";

/**
 * 从数据库实时读取账号状态与菜单权限。
 *
 * 刻意不把权限写进 JWT：会话有效期 7 天，写进去会导致管理员改权限后
 * 最长 7 天不生效。这里用原生 fetch 直连 PostgREST，以便在 middleware
 * 的 Edge 运行时中使用（supabase-js 不在 Edge 打包）。
 */

export type UserAccess = {
  role: string;
  isActive: boolean;
  menus: string[];
};

export async function fetchUserAccess(
  userId: string
): Promise<UserAccess | null> {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  try {
    const res = await fetch(
      `${url}/rest/v1/app_users?id=eq.${encodeURIComponent(
        userId
      )}&select=role,is_active,menu_perms&limit=1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{
      role: string;
      is_active: boolean;
      menu_perms: string[] | null;
    }>;
    const row = rows?.[0];
    // 账号已被删除：视为无权限，交由调用方登出
    if (!row) return { role: "user", isActive: false, menus: [] };
    return {
      role: row.role,
      isActive: !!row.is_active,
      menus: resolveMenus(row.role, row.menu_perms),
    };
  } catch {
    // 查询失败（数据库抖动等）返回 null，由调用方放行，避免整站不可用
    return null;
  }
}
