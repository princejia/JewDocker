import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, verifySession } from "@/lib/auth";
import { apiMenuKeyForPath, menuKeyForPath } from "@/lib/menus";
import { fetchUserAccess } from "@/lib/user-access";

// 无需登录即可访问的接口，其余 /api/* 一律要求有效会话
const PUBLIC_API = new Set(["/api/auth/login", "/api/auth/logout"]);
// 与菜单权限无关的接口：会话自身、通用选项、文件上传
const PERM_FREE_API_PREFIX = ["/api/auth", "/api/options", "/api/upload"];
const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function isPublicPage(pathname: string) {
  return (
    pathname.startsWith("/login") ||
    pathname === "/v" ||
    pathname.startsWith("/v/")
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const session = await verifySession(token);
  const isApi = pathname.startsWith("/api/");

  // 接口用 401 应答而非重定向，否则前端会拿到一段登录页 HTML 当作 JSON 解析
  if (isApi && (PUBLIC_API.has(pathname) || !session)) {
    if (PUBLIC_API.has(pathname)) return NextResponse.next();
    return NextResponse.json({ error: "未登录或会话已过期" }, { status: 401 });
  }

  if (!session) {
    // 未登录用户重定向到登录页（扫码公开展示页 /v 除外）
    if (isPublicPage(pathname)) return NextResponse.next();
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 已登录用户访问登录页，重定向到首页
  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.url));
  }
  if (!isApi && isPublicPage(pathname)) return NextResponse.next();

  // 权限实时取自数据库（不写进 JWT，否则改权限要等会话过期才生效）；
  // 查询失败时放行，避免数据库抖动导致整站不可用
  const access = await fetchUserAccess(session.sub);
  if (!access) return NextResponse.next();

  // 账号被停用或删除：立即失效
  if (!access.isActive) {
    if (isApi) {
      return NextResponse.json({ error: "账号已停用" }, { status: 401 });
    }
    const res = NextResponse.redirect(new URL("/login", req.url));
    res.cookies.delete(AUTH_COOKIE);
    return res;
  }

  if (isApi) {
    // 只拦增删改：读接口存在跨模块调用，按菜单收紧会破坏现有功能
    if (READ_METHODS.has(req.method)) return NextResponse.next();
    if (PERM_FREE_API_PREFIX.some((p) => pathname.startsWith(p))) {
      return NextResponse.next();
    }
    const apiKey = apiMenuKeyForPath(pathname);
    if (apiKey && !access.menus.includes(apiKey)) {
      return NextResponse.json({ error: "无该菜单的操作权限" }, { status: 403 });
    }
    return NextResponse.next();
  }

  const menuKey = menuKeyForPath(pathname);
  if (menuKey && !access.menus.includes(menuKey)) {
    // 退回到第一个有权访问的菜单；一个都没有则进入无权限提示页
    return NextResponse.redirect(
      new URL(access.menus[0] ?? "/no-access", req.url)
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
