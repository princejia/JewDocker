/**
 * 菜单权限的唯一事实来源。
 *
 * 此文件被 middleware（Edge）、服务端与客户端共同引用，
 * 因此不得引入 icon、bcrypt、supabase-js 等仅单端可用的依赖。
 * 菜单 key 直接使用路由前缀，便于按路径鉴权。
 */

export type MenuDef = {
  key: string;
  label: string;
  superAdminOnly?: boolean;
};

export const MENUS: MenuDef[] = [
  { key: "/", label: "仪表盘" },
  { key: "/products", label: "产品管理" },
  { key: "/loose-stones", label: "裸石管理" },
  { key: "/quotes", label: "报价管理" },
  { key: "/sales", label: "销售记录" },
  { key: "/processings", label: "加工管理" },
  { key: "/loans", label: "借调管理" },
  { key: "/recycles", label: "回收管理" },
  { key: "/customers", label: "客户管理" },
  { key: "/reports", label: "财务报表" },
  { key: "/users", label: "账号管理", superAdminOnly: true },
];

/** 可分配给普通用户的菜单（超管专属菜单不可分配）。 */
export const ASSIGNABLE_MENUS = MENUS.filter((m) => !m.superAdminOnly);

const ALL_KEYS = MENUS.map((m) => m.key);
const DEFAULT_KEYS = ASSIGNABLE_MENUS.map((m) => m.key);

export function menuLabel(key: string): string {
  return MENUS.find((m) => m.key === key)?.label ?? key;
}

/**
 * 计算用户实际可访问的菜单。
 * - 超级管理员：全部菜单
 * - menu_perms 为 null/undefined：默认全部业务菜单（兼容历史账号）
 * - 其余：按配置取交集，超管专属菜单永远剔除
 */
export function resolveMenus(
  role: string,
  menuPerms: unknown
): string[] {
  if (role === "super_admin") return [...ALL_KEYS];
  if (!Array.isArray(menuPerms)) return [...DEFAULT_KEYS];
  return DEFAULT_KEYS.filter((key) => menuPerms.includes(key));
}

/** 过滤掉非法 / 超管专属的 key，用于写库前清洗。 */
export function sanitizeMenuPerms(input: string[]): string[] {
  return DEFAULT_KEYS.filter((key) => input.includes(key));
}

function matches(pathname: string, key: string): boolean {
  if (key === "/") return pathname === "/";
  return pathname === key || pathname.startsWith(`${key}/`);
}

/** 页面路径对应的菜单 key；未纳入菜单体系的路径返回 null（不做限制）。 */
export function menuKeyForPath(pathname: string): string | null {
  return MENUS.find((m) => matches(pathname, m.key))?.key ?? null;
}

/**
 * 写操作接口 → 菜单 key 的映射。
 * 仅用于拦截增删改：读接口存在跨模块调用（如借调弹窗要读产品列表），
 * 按菜单收紧读权限会直接破坏现有功能。
 */
const API_MENU_MAP: Array<[string, string]> = [
  ["/api/products", "/products"],
  ["/api/loose-stones", "/loose-stones"],
  ["/api/quotes", "/quotes"],
  ["/api/quote-items", "/quotes"],
  ["/api/sales", "/sales"],
  ["/api/returns", "/sales"],
  ["/api/loans", "/loans"],
  ["/api/processings", "/processings"],
  ["/api/recycles", "/recycles"],
  ["/api/customers", "/customers"],
];

export function apiMenuKeyForPath(pathname: string): string | null {
  const hit = API_MENU_MAP.find(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
  return hit ? hit[1] : null;
}
