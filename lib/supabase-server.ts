import { createClient } from "@supabase/supabase-js";

/**
 * 服务端数据访问客户端，使用 service role key。
 * 仅可在 API Routes / Server Components 中使用，切勿暴露给浏览器。
 *
 * SUPABASE_URL 指向内网 PostgREST 网关（自建部署）或 Supabase 项目地址。
 * 它不带 NEXT_PUBLIC_ 前缀，因此不会被打进客户端 bundle。
 */
export function createServerClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) {
    throw new Error("缺少 SUPABASE_URL 环境变量。");
  }
  if (!serviceRoleKey) {
    throw new Error(
      "缺少 SUPABASE_SERVICE_ROLE_KEY 环境变量，请在部署环境中配置。"
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      // 关闭 Next.js Data Cache，确保服务端读取的始终是最新数据
      // （否则仪表盘 / 详情页 / 接口可能返回被缓存的旧数据，
      //  例如删除图片后重新打开仍显示旧图）
      fetch: (input, init) =>
        fetch(input as RequestInfo, { ...init, cache: "no-store" }),
    },
  });
}
