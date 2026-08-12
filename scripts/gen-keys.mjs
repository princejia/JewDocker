/**
 * 生成自建部署所需的全部密钥，输出可直接粘贴的 .env 内容。
 *
 * 用法：node scripts/gen-keys.mjs > .env  （随后 chmod 600 .env）
 *
 * PostgREST 用 JWT_SECRET 校验 supabase-js 发来的 Bearer token，
 * 并读取其中的 role 声明决定数据库角色，因此两个 key 必须由同一 secret 签发。
 *
 * 刻意不依赖任何三方库：这是部署第一步要跑的引导脚本，
 * 此时服务器上往往还没有 node_modules，也不该为它装。
 */
import { randomBytes, createHmac } from "node:crypto";

// base64url 字符集不含引号和 URI 保留字符，可安全嵌入 SQL 字面量与连接串
const rand = (bytes = 32) => randomBytes(bytes).toString("base64url");

const jwtSecret = rand(32);

const b64url = (input) => Buffer.from(input).toString("base64url");

const issueKey = (role) => {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ role, iat: now, exp: now + 10 * 365 * 24 * 3600 })
  );
  const data = `${header}.${payload}`;
  const signature = createHmac("sha256", jwtSecret)
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
};

const anonKey = issueKey("anon");
const serviceRoleKey = issueKey("service_role");

process.stdout.write(`# 由 scripts/gen-keys.mjs 生成于 ${new Date().toISOString()}
# 此文件包含全部生产密钥，切勿提交到 Git

POSTGRES_PASSWORD=${rand(24)}
AUTHENTICATOR_PASSWORD=${rand(24)}

JWT_SECRET=${jwtSecret}
ANON_KEY=${anonKey}
SERVICE_ROLE_KEY=${serviceRoleKey}

# 会话 cookie 签名密钥，与上面的 JWT_SECRET 无关，不要复用
AUTH_SECRET=${rand(32)}

# 腾讯云 COS（在控制台创建存储桶与子账号后填写）
# COS_BUCKET 必须带 APPID 后缀，如 jewelry-1300000000
COS_REGION=ap-guangzhou
COS_BUCKET=
COS_SECRET_ID=
COS_SECRET_KEY=
# 可选：绑定的 CDN 自定义域名，留空则用存储桶默认域名
COS_PUBLIC_BASE_URL=
`);
