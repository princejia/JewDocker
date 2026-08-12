import { NextRequest, NextResponse } from "next/server";
import { AUTH_COOKIE, verifySession } from "@/lib/auth";

// 无需登录即可访问的接口，其余 /api/* 一律要求有效会话
const PUBLIC_API = new Set(["/api/auth/login", "/api/auth/logout"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  const session = await verifySession(token);

  // 接口用 401 应答而非重定向，否则前端会拿到一段登录页 HTML 当作 JSON 解析
  if (pathname.startsWith("/api/")) {
    if (PUBLIC_API.has(pathname) || session) return NextResponse.next();
    return NextResponse.json({ error: "未登录或会话已过期" }, { status: 401 });
  }

  // 未登录用户重定向到登录页（扫码公开展示页 /v 除外）
  if (
    !session &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/v/")
  ) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // 已登录用户访问登录页，重定向到首页
  if (session && pathname === "/login") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
