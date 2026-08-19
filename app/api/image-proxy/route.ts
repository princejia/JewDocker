import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_SIZE = 10 * 1024 * 1024;

/** 允许代理的对象存储域名，与 next.config.mjs 的图片白名单保持一致 */
function allowedHosts() {
  const hosts = new Set<string>();
  if (process.env.COS_PUBLIC_BASE_URL) {
    try {
      hosts.add(new URL(process.env.COS_PUBLIC_BASE_URL).hostname);
    } catch {
      /* 配置为空或非法时忽略 */
    }
  }
  if (process.env.COS_BUCKET && process.env.COS_REGION) {
    hosts.add(
      `${process.env.COS_BUCKET}.cos.${process.env.COS_REGION}.myqcloud.com`,
    );
  }
  return hosts;
}

/**
 * 把 COS 图片以同源方式透出，供导出 Excel 时读入 canvas。
 * 直接用 <img crossOrigin> 拉 COS 会因缺少 CORS 响应头而失败。
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) {
    return NextResponse.json({ error: "缺少 url 参数" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "url 非法" }, { status: 400 });
  }

  // 仅允许白名单内的 https 主机，避免被当作 SSRF 跳板
  if (target.protocol !== "https:" || !allowedHosts().has(target.hostname)) {
    return NextResponse.json({ error: "不允许的图片来源" }, { status: 403 });
  }

  const upstream = await fetch(target.toString(), { redirect: "error" });
  if (!upstream.ok) {
    return NextResponse.json({ error: "图片获取失败" }, { status: 502 });
  }

  const contentType = upstream.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "目标不是图片" }, { status: 415 });
  }

  const buffer = await upstream.arrayBuffer();
  if (buffer.byteLength > MAX_SIZE) {
    return NextResponse.json({ error: "图片过大" }, { status: 413 });
  }

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
