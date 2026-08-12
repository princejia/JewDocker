/**
 * 生成自建部署所需的全部密钥，输出可直接粘贴的 .env 内容。
 *
 * 用法：node scripts/gen-keys.mjs > .env  （随后 chmod 600 .env）
 *
 * PostgREST 用 JWT_SECRET 校验 supabase-js 发来的 Bearer token，
 * 并读取其中的 role 声明决定数据库角色，因此两个 key 必须由同一 secret 签发。
 */
import { SignJWT } from "jose";
import { randomBytes } from "node:crypto";

// base64url 字符集不含引号和 URI 保留字符，可安全嵌入 SQL 字面量与连接串
const rand = (bytes = 32) => randomBytes(bytes).toString("base64url");

const jwtSecret = rand(32);
const encoded = new TextEncoder().encode(jwtSecret);

const issueKey = (role) =>
  new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime("10y")
    .sign(encoded);

const [anonKey, serviceRoleKey] = await Promise.all([
  issueKey("anon"),
  issueKey("service_role"),
]);

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
