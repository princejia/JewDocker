# 珠宝黄金销售管理系统

Jewelry & Gold Sales Management System — 基于 **Next.js 14** 的珠宝库存与销售管理工具，完全自托管，不依赖任何 SaaS。

## 功能

- 📊 仪表盘：在库数量、本月销售额/利润、未结款、借售待办
- 💎 产品管理：卡片/表格视图、筛选搜索、多图上传、利润与未结款实时计算
- 💠 裸石管理：裸石独立建档，可加工为产品并保留来源追溯
- 🧾 销售与退货：销售流水、退货冲正、客单价统计
- 🤝 借调管理：借出与归还记录
- 👥 客户管理：客户档案与历史往来
- 📈 财务报表：销售趋势图、库存价值、未结款汇总、借售追踪
- 🏷️ 标签与扫码：批量生成二维码标签 PDF，扫码直达对应记录
- 🔐 自建账号体系：bcrypt 密码 + httpOnly JWT Cookie，middleware 统一鉴权

## 架构

项目最初跑在 Supabase + Vercel 上，现已整体迁移为自托管。对应关系：

| 原方案 | 现方案 |
|---|---|
| Supabase 托管 PostgreSQL | `postgres:16-alpine` 容器 |
| Supabase REST | `postgrest/postgrest` 容器 + nginx 网关 |
| Supabase Storage | 腾讯云 COS |
| Supabase Auth | `app_users` 表 + bcrypt + jose 签发的 HS256 会话 Cookie |
| Vercel | 腾讯云轻量应用服务器 + Docker Compose + 宿主机 Nginx |

应用代码仍在用 `@supabase/supabase-js`，因为 PostgREST 本就是 Supabase REST 层的实现。网关把 SDK 约定的 `/rest/v1/xxx` 转发到 PostgREST 根路径，SDK 侧无需任何改动。

```
浏览器 ──HTTPS──> 宿主机 Nginx ──> web (Next.js standalone, 仅监听 127.0.0.1:3000)
                                     │
                                     ├──> gateway (nginx) ──> postgrest ──> db (PostgreSQL 16)
                                     └──> 腾讯云 COS（图片与认证报告）
```

四个容器只有 `web` 暴露端口，且绑定回环地址；`db`、`postgrest`、`gateway` 均不出 Docker 网络。

## 本地开发

```bash
npm install
cp .env.local.example .env.local
```

数据库相关服务用容器起，Next.js 跑在宿主机：

```bash
docker compose up -d db postgrest gateway
npm run dev
```

需要在 `docker-compose.yml` 里给 `gateway` 临时加一行 `ports: ["8000:80"]`，并把 `.env.local` 的 `SUPABASE_URL` 指向 `http://localhost:8000`。`SUPABASE_SERVICE_ROLE_KEY` 与 `AUTH_SECRET` 可用 `node scripts/gen-keys.mjs` 生成一份取用。

访问 http://localhost:3000

首次登录前需在 `.env.local` 里设好 `SEED_ADMIN_USERNAME` 与 `SEED_ADMIN_PASSWORD`，应用会在 `app_users` 为空时用它们创建超管。两项未配置则不创建任何账号——**没有默认密码**。

## 生产部署

完整流程见 [design.md](design.md) 第七章。最短路径：

```bash
git clone <repo> /opt/jewelry && cd /opt/jewelry
node scripts/gen-keys.mjs > .env && chmod 600 .env
vi .env                      # 填入 COS_BUCKET / COS_SECRET_ID / COS_SECRET_KEY
docker compose up -d --build
```

`scripts/gen-keys.mjs` 零依赖，只用 Node 内置模块，不需要先 `npm install`。它生成的 `ANON_KEY` 与 `SERVICE_ROLE_KEY` 是用同一个 `JWT_SECRET` 签发的 HS256 token，PostgREST 靠其中的 `role` 声明决定数据库角色。

`web` 只监听 `127.0.0.1:3000`，公网流量需由宿主机 Nginx 反代并终止 TLS。

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Next.js 14 (App Router)，`output: "standalone"` |
| UI | Tailwind CSS + shadcn/ui 风格组件 |
| 数据库 | PostgreSQL 16（自建容器） |
| 数据访问 | PostgREST + `@supabase/supabase-js` |
| 存储 | 腾讯云 COS（`cos-nodejs-sdk-v5`） |
| 认证 | bcryptjs + jose（HS256 / httpOnly Cookie） |
| 图表 | Recharts |
| 校验 | Zod |
| 编排 | Docker Compose |

## 目录结构

```
app/
  (auth)/login          登录页
  (dashboard)/          后台（仪表盘/产品/裸石/销售/客户/报表/扫码/用户）
  v/[type]/[id]/        公开展示页（扫码跳转，与标签同口径）
  api/                  API Routes
components/             UI 与业务组件
lib/
  auth.ts               会话签发与校验
  users.ts              账号与密码哈希
  supabase-server.ts    服务端数据访问客户端（service_role）
  labels.ts             二维码标签与 PDF 导出
middleware.ts           全站鉴权入口（含 /api）
docker/gateway.conf     /rest/v1 前缀重写
supabase/
  schema.sql            建表脚本
  init/                 容器首次启动的角色与授权脚本
scripts/
  gen-keys.mjs          生成生产 .env
  backup-db.sh          数据库备份到 COS
Dockerfile              三阶段构建
docker-compose.yml      四容器编排
```

## 安全要点

- `middleware.ts` 的 matcher **覆盖 `/api`**。所有业务路由都用 `service_role` 访问数据库（BYPASSRLS），一旦把 `/api` 排除在鉴权外，任何人都能匿名读取全部客户与库存数据。
- 数据库的 `anon` 角色没有任何表授权，即使 PostgREST 被直接触达也读不到数据。
- 仓库内不包含任何可用凭据：建表脚本不插入账号，初始超管密码由 `gen-keys.mjs` 随机生成，每次部署不同。
- 上传接口只按 MIME 类型推导扩展名，用户文件名不参与对象键构造。
- `AUTH_SECRET` 在生产环境缺失时直接启动失败，不会静默降级。
