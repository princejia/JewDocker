# 珠宝黄金销售管理系统
## Jewelry & Gold Sales Management System — 技术设计文档 v2.0

**技术栈：** Next.js 14 (App Router) + PostgREST + PostgreSQL（全栈自托管）  
**数据库：** PostgreSQL 16（自建容器）  
**部署平台：** 腾讯云轻量应用服务器 · Docker Compose  
**预计月成本：** ¥60 起（服务器 + 对象存储）

---

## 目录

1. [项目概述](#一项目概述)
2. [数据库设计](#二数据库设计)
3. [系统架构](#三系统架构)
4. [功能模块设计](#四功能模块设计)
5. [API 接口设计](#五api-接口设计)
6. [前端页面设计](#六前端页面设计)
7. [部署流程](#七部署流程)
8. [安全与权限设计](#八安全与权限设计)
9. [开发建议与扩展方向](#九开发建议与扩展方向)

---

## 一、项目概述

### 1.1 项目背景与目标

珠宝黄金行业具有产品单价高、库存种类多、销售周期不固定的特点，需要一套专业的销售管理工具来：

- 追踪每件产品的完整生命周期（从购入到出售）
- 实时掌握销售状态（已结款、未结款、借售）
- 管理裸石与镶嵌成品的区分，并可标记裸石是否已用于产品
- 产品与裸石均可出售、借调，并追踪认证报告（文档 / 图片）
- 统计利润、汇总财务数据
- 支持产品图片展示，便于识别和管理
- 支持为产品/裸石批量打印二维码标签，并通过扫码快速定位对应记录

### 1.2 技术栈选型

| 层级 | 技术选型 | 选型理由 |
|------|----------|----------|
| 前端框架 | Next.js 14 (App Router) | 内置 SSR/SSG，`output: "standalone"` 产物可直接容器化 |
| UI 组件库 | shadcn/ui + Tailwind CSS | 无头组件，样式灵活，无额外费用 |
| 后端 API | Next.js API Routes | 与前端同仓库，运行在自建 Node 容器中 |
| 数据库 | PostgreSQL 16（自建容器） | 数据完全自持，无容量与出海延迟限制 |
| 数据访问层 | PostgREST v12 + `@supabase/supabase-js` | PostgREST 即 Supabase REST 层的实现，网关重写前缀后 SDK 代码零改动 |
| 文件存储 | 腾讯云 COS | 国内访问快，按量计费，图片与认证报告分目录存放 |
| 认证鉴权 | 自建用户名登录（JWT + bcrypt） | 账号存于 `app_users` 表，密码 bcrypt 哈希；jose 签发 HS256 会话存于 httpOnly Cookie，仅超管可后台新增账号 |
| 二维码 | qrcode + jspdf + html5-qrcode | 客户端生成标签二维码（qrcode）、导出标签 PDF（jspdf）与拍照/选图识别（html5-qrcode scanFile），纯前端运行，免费 |
| 部署托管 | 腾讯云轻量 + Docker Compose | 国内访问稳定，可备案；四容器一键起停 |

> **为什么迁离 Supabase + Vercel：** 两者服务器均在海外，国内访问不稳定且数据库延迟高；域名要在大陆合规提供服务还需备案，而备案要求服务器在境内。迁移后 `@supabase/supabase-js` 保留未换，因为 PostgREST 就是 Supabase REST 层本身。

---

## 二、数据库设计

### 2.1 主表：products（产品主表）

| 字段名（英文） | 字段名（中文） | 数据类型 | 说明 |
|---------------|---------------|----------|------|
| id | 主键 | UUID | 自动生成，唯一标识每件产品 |
| code | 产品编号 | VARCHAR(20) | 入库时自动生成并存储，规则 `P + 北京时间年月日时分秒`（如 `P20260624153012`），全表唯一，便于查询 |
| image_urls | 产品图片 | TEXT[] | 图片 URL 数组，存储在腾讯云 COS |
| name | 产品名称 | VARCHAR(255) | 产品完整名称，如：18K金钻石戒指 |
| total_weight | 重量 | DECIMAL(10,3) | 产品重量，精度至小数点后3位，单位由 weight_unit 决定 |
| weight_unit | 重量单位 | VARCHAR(20) | 可输入单位，默认“克(g)”，可选“克拉(ct)”或自定义 |
| size | 尺寸 | VARCHAR(100) | 尺寸信息，如：戒指12号、手链18cm |
| origin | 产地 | VARCHAR(100) | 产地信息，如：深圳水贝、香港等 |
| inlaid_stones | 镶嵌配石 | TEXT | 配石描述，如：主石1ct D/VVS1，配石0.3ct |
| certificate_urls | 认证报告 | TEXT[] | 认证报告文件 URL 数组，支持图片与文档（PDF/Word），存储在腾讯云 COS |
| gemstone_category | 宝石分类 | VARCHAR(100) | 自由文本，支持输入并按历史值模糊自动补全，可为空 |
| function_category | 功能分类 | VARCHAR(100) | 自由文本，支持输入并按历史值模糊自动补全，可为空 |
| source_loose_stone_id | 来源裸石 | UUID FK | 关联 loose_stones.id，可为空（由裸石加工生产时填写） |
| price | 价格(¥) | DECIMAL(12,2) | 销售报价，人民币，必填 |
| purchase_price | 进货价(¥) | DECIMAL(12,2) | 购入成本，用于计算利润 |
| sale_price | 出售价(¥) | DECIMAL(12,2) | 真实成交出售价格，销售时回写 |
| sale_status | 销售情况 | ENUM | in_stock（在库）/ sold（已售）/ consignment（借售），在【销售管理】中变更 |
| settled_amount | 结款(¥) | DECIMAL(12,2) | 已收款金额；【出售】=成交价，【借售】=0 |
| unsettled_amount | 未结款(¥) | DECIMAL(12,2) | **自动计算** = price - settled_amount（仅对借售展示，在库/已售不显示）。借售已结款=0，故未结款=整件标价 |
| is_consignment | 借售 | BOOLEAN | 是否为借售/寄售模式 |
| is_loose_stone | 裸石 | BOOLEAN | 是否为裸石（未镶嵌） |
| profit | 利润(¥) | DECIMAL(12,2) | **自动计算** = price - purchase_price |
| purchased_at | 购入时间 | DATE | 产品购入日期 |
| sold_at | 出售时间 | DATE | 产品售出日期，未售出时为 NULL |
| created_at | 创建时间 | TIMESTAMPTZ | 记录创建时间，数据库自动设置 |
| updated_at | 更新时间 | TIMESTAMPTZ | 最后更新时间，自动维护 |
| notes | 备注 | TEXT | 额外备注信息，可选填 |

> **产品编号**：`code` 字段在入库时由数据库触发器自动生成并持久化，规则为 `P + 北京时间年月日时分秒`（如 `P20260624153012`），可直接用于搜索与查询。编号由发号表 `record_code_seq` 统一分配，同一秒内（含单条语句批量插入）自动顺延到下一秒，并有唯一索引兜底，不会重复。

### 2.2 辅助表：customers（客户表）

| 字段名 | 中文名 | 类型 | 说明 |
|--------|--------|------|------|
| id | 主键 | UUID | 唯一标识 |
| name | 客户姓名 | VARCHAR(100) | 客户真实姓名或昵称 |
| phone | 联系电话 | VARCHAR(20) | 手机号码 |
| wechat | 微信号 | VARCHAR(100) | 微信联系方式 |
| notes | 备注 | TEXT | 客户偏好、特别说明等 |
| created_at | 创建时间 | TIMESTAMPTZ | 自动设置 |

### 2.3 关联表：product_sales（销售记录表）

| 字段名 | 中文名 | 类型 | 说明 |
|--------|--------|------|------|
| id | 主键 | UUID | 唯一标识 |
| product_id | 产品ID | UUID FK | 关联 products.id，可为空（出售裸石时为空） |
| loose_stone_id | 裸石ID | UUID FK | 关联 loose_stones.id，可为空（出售产品时为空） |
| customer_id | 客户ID | UUID FK | 关联 customers.id，可为空 |
| sale_price | 成交价格 | DECIMAL(12,2) | 实际成交金额 |
| payment_method | 付款方式 | VARCHAR(50) | 现金/微信/支付宝/银行转账/信用卡 |
| sold_at | 成交时间 | DATE | 实际售出日期 |
| created_at | 记录时间 | TIMESTAMPTZ | 自动设置 |

> 销售记录同时支持**产品**与**裸石**：`product_id` 与 `loose_stone_id` 二者填其一。出售方式支持【出售】与【借售】，提交后自动回写对应物品的销售状态与出售价。【出售】结款=成交价（未结款 0）；【借售】结款=0，未结款=整件标价。

### 2.4 辅助表：loose_stones（裸石表）

裸石为未加工的原石，products 可由裸石加工生产（通过 `products.source_loose_stone_id` 建立关联）。

| 字段名 | 中文名 | 类型 | 说明 |
|--------|--------|------|------|
| id | 主键 | UUID | 唯一标识 |
| code | 裸石编号 | VARCHAR(20) | 入库时自动生成并存储，规则 `L + 北京时间年月日时分秒`（如 `L20260624153012`），全表唯一 |
| image_urls | 裸石图片 | TEXT[] | 图片 URL 数组，存储在腾讯云 COS |
| material | 产品名称 | VARCHAR(100) | 裸石产品名称，如：天然翡翠、矢车菊蓝宝 |
| size | 尺寸 | VARCHAR(100) | 裸石尺寸，如：10×8mm |
| weight | 重量 | DECIMAL(10,3) | 裸石重量，单位由 weight_unit 决定 |
| weight_unit | 重量单位 | VARCHAR(20) | 可输入单位，默认“克(g)”，可选“克拉(ct)”或自定义 |
| price | 价格 | DECIMAL(12,2) | 裸石价格 |
| gemstone_category | 宝石分类 | VARCHAR(100) | 自由文本，支持输入并按历史值模糊自动补全 |
| origin | 产地 | VARCHAR(100) | 裸石产地 |
| certificate | 证书 | VARCHAR(255) | 证书编号或描述 |
| certificate_urls | 认证报告 | TEXT[] | 认证报告文件 URL 数组，支持图片与文档（PDF/Word） |
| sale_status | 销售情况 | ENUM | in_stock（在库）/ sold（已售）/ consignment（借售），在【销售管理】中变更 |
| purchase_price | 进货价(¥) | DECIMAL(12,2) | 购入成本 |
| sale_price | 售出价(¥) | DECIMAL(12,2) | 售出价格，销售时回写 |
| purchased_at | 购入时间 | DATE | 裸石购入日期 |
| sold_at | 卖出时间 | DATE | 裸石卖出日期，未售出时为 NULL |
| notes | 备注 | TEXT | 额外备注，可选填 |
| created_at | 创建时间 | TIMESTAMPTZ | 自动设置 |
| updated_at | 更新时间 | TIMESTAMPTZ | 自动维护 |

> **裸石状态展示**：裸石列表/卡片/表格会根据数据派生状态显示徽标——销售状态（已售/借售）、**已用于产品**（被某件产品通过 `source_loose_stone_id` 引用时）、**借调中**（存在未归还的借调记录时）。

### 2.5 关联表：product_returns（退货记录表）

退货与销售记录关联，登记退货后对应产品自动恢复为【在库】状态。

| 字段名 | 中文名 | 类型 | 说明 |
|--------|--------|------|------|
| id | 主键 | UUID | 唯一标识 |
| sale_id | 销售ID | UUID FK | 关联 product_sales.id，可为空 |
| product_id | 产品ID | UUID FK | 关联 products.id，可为空 |
| customer_id | 客户ID | UUID FK | 关联 customers.id，可为空 |
| refund_amount | 退款金额 | DECIMAL(12,2) | 退还给客户的金额 |
| reason | 退货原因 | TEXT | 退货说明，可选填 |
| returned_at | 退货时间 | DATE | 退货日期 |
| created_at | 记录时间 | TIMESTAMPTZ | 自动设置 |

### 2.6 关联表：item_loans（借调记录表）

产品与裸石均可借调。登记借出后，对应产品/裸石在列表中显示【借调中】状态；登记归还后状态恢复。

| 字段名 | 中文名 | 类型 | 说明 |
|--------|--------|------|------|
| id | 主键 | UUID | 唯一标识 |
| product_id | 产品ID | UUID FK | 关联 products.id，可为空 |
| loose_stone_id | 裸石ID | UUID FK | 关联 loose_stones.id，可为空（与 product_id 二选一） |
| borrower_name | 借出人 | VARCHAR(100) | 必填 |
| borrower_contact | 联系方式 | VARCHAR(100) | 可选填 |
| loaned_at | 借出日期 | DATE | 默认当天 |
| due_at | 预计归还 | DATE | 可选填 |
| returned_at | 归还日期 | DATE | 为空表示借出中，填写后表示已归还 |
| notes | 备注 | TEXT | 可选填 |
| created_at | 记录时间 | TIMESTAMPTZ | 自动设置 |

### 2.7 关联表：recycles（回收记录表）

登记从客户处回收的旧料，可关联多件本店产品（例如以旧换新时对应的新品）。

| 字段名 | 中文名 | 类型 | 说明 |
|--------|--------|------|------|
| id | 主键 | UUID | 唯一标识 |
| category | 分类 | VARCHAR(20) | 黄金 / 宝石 |
| recycled_at | 日期 | DATE | 默认当天 |
| product_ids | 关联产品 | UUID[] | 产品 id 数组，可多选，也可为空 |
| notes | 备注 | TEXT | 可选填 |
| created_at | 记录时间 | TIMESTAMPTZ | 自动设置 |

> 关联产品用数组而非中间表：一次写入即完成，避免跨表非事务写入的半成品数据。产品被删除后数组中的 id 会成为悬空引用，列表页显示为「已删除产品」。

### 2.8 SQL 建表语句

在 Supabase SQL Editor 中执行：

```sql
-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 销售状态枚举
CREATE TYPE sale_status_enum AS ENUM (
  'in_stock',       -- 在库
  'sold',           -- 已售
  'consignment'     -- 借售
);

-- 宝石分类 / 功能分类已改为自由文本（VARCHAR(100)），不再使用枚举类型

-- 裸石表（products 可由裸石加工生产）
CREATE TABLE loose_stones (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code               VARCHAR(20),    -- 裸石编号，自动生成
  image_urls         TEXT[] DEFAULT '{}',
  material           VARCHAR(100),   -- 产品名称
  size               VARCHAR(100),
  weight             DECIMAL(10,3),
  price              DECIMAL(12,2) DEFAULT 0,
  gemstone_category  VARCHAR(100),
  origin             VARCHAR(100),   -- 产地
  certificate        VARCHAR(255),   -- 证书
  certificate_urls   TEXT[] DEFAULT '{}',      -- 认证报告（图片/文档）
  weight_unit        VARCHAR(20) DEFAULT '克(g)',  -- 重量单位
  sale_status        sale_status_enum DEFAULT 'in_stock',  -- 销售状态
  purchase_price     DECIMAL(12,2) DEFAULT 0,  -- 进货价
  sale_price         DECIMAL(12,2) DEFAULT 0,  -- 售出价
  purchased_at       DATE,           -- 购入时间
  sold_at            DATE,           -- 卖出时间
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- 产品主表
CREATE TABLE products (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code             VARCHAR(20),    -- 产品编号，自动生成
  image_urls       TEXT[] DEFAULT '{}',
  name             VARCHAR(255) NOT NULL,
  total_weight     DECIMAL(10,3),
  weight_unit      VARCHAR(20) DEFAULT '克(g)',   -- 重量单位
  size             VARCHAR(100),
  origin           VARCHAR(100),
  inlaid_stones    TEXT,
  certificate_urls TEXT[] DEFAULT '{}',          -- 认证报告（图片/文档）
  gemstone_category VARCHAR(100),
  function_category VARCHAR(100),
  source_loose_stone_id UUID REFERENCES loose_stones(id) ON DELETE SET NULL,
  price            DECIMAL(12,2) NOT NULL DEFAULT 0,
  purchase_price   DECIMAL(12,2) DEFAULT 0,
  sale_price       DECIMAL(12,2) DEFAULT 0,       -- 出售价
  sale_status      sale_status_enum DEFAULT 'in_stock',
  settled_amount   DECIMAL(12,2) DEFAULT 0,
  -- 未结款：自动计算字段
  unsettled_amount DECIMAL(12,2) GENERATED ALWAYS AS (price - settled_amount) STORED,
  is_consignment   BOOLEAN DEFAULT FALSE,
  is_loose_stone   BOOLEAN DEFAULT FALSE,
  -- 利润：自动计算字段
  profit           DECIMAL(12,2) GENERATED ALWAYS AS (price - purchase_price) STORED,
  purchased_at     DATE,
  sold_at          DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 客户表
CREATE TABLE customers (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(100) NOT NULL,
  phone      VARCHAR(20),
  wechat     VARCHAR(100),
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 销售记录表（product_id 与 loose_stone_id 二选一）
CREATE TABLE product_sales (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id     UUID REFERENCES products(id) ON DELETE CASCADE,
  loose_stone_id UUID REFERENCES loose_stones(id) ON DELETE CASCADE,
  customer_id    UUID REFERENCES customers(id) ON DELETE SET NULL,
  sale_price     DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(50),
  sold_at        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 退货记录表（登记退货后产品恢复为在库）
CREATE TABLE product_returns (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id        UUID REFERENCES product_sales(id) ON DELETE SET NULL,
  product_id     UUID REFERENCES products(id) ON DELETE SET NULL,
  customer_id    UUID REFERENCES customers(id) ON DELETE SET NULL,
  refund_amount  DECIMAL(12,2) DEFAULT 0,
  reason         TEXT,
  returned_at    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 借调记录表（产品与裸石均可借调）
CREATE TABLE item_loans (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id       UUID REFERENCES products(id) ON DELETE CASCADE,
  loose_stone_id   UUID REFERENCES loose_stones(id) ON DELETE CASCADE,
  borrower_name    VARCHAR(100) NOT NULL,
  borrower_contact VARCHAR(100),
  loaned_at        DATE NOT NULL DEFAULT CURRENT_DATE,
  due_at           DATE,
  returned_at      DATE,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 编号自动生成（前缀 + 北京时间年月日时分秒），发号表保证唯一
CREATE TABLE record_code_seq (
  prefix    VARCHAR(4) PRIMARY KEY,
  last_code VARCHAR(20) NOT NULL
);

CREATE OR REPLACE FUNCTION next_record_code(p_prefix TEXT, p_at TIMESTAMPTZ)
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
BEGIN
  INSERT INTO record_code_seq AS s (prefix, last_code)
  VALUES (
    p_prefix,
    p_prefix || to_char(COALESCE(p_at, NOW()) AT TIME ZONE 'Asia/Shanghai', 'YYYYMMDDHH24MISS')
  )
  ON CONFLICT (prefix) DO UPDATE
    SET last_code = s.prefix || to_char(
      GREATEST(
        to_timestamp(substring(EXCLUDED.last_code FROM 2), 'YYYYMMDDHH24MISS'),
        to_timestamp(substring(s.last_code FROM 2), 'YYYYMMDDHH24MISS') + INTERVAL '1 second'
      ),
      'YYYYMMDDHH24MISS'
    )
  RETURNING s.last_code INTO v_code;

  RETURN v_code;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_record_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.code IS NULL OR NEW.code = '' THEN
    NEW.code := next_record_code(TG_ARGV[0], NEW.created_at);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_set_code
  BEFORE INSERT ON products
  FOR EACH ROW EXECUTE FUNCTION set_record_code('P');

CREATE TRIGGER loose_stones_set_code
  BEFORE INSERT ON loose_stones
  FOR EACH ROW EXECUTE FUNCTION set_record_code('L');

-- 常用索引
CREATE INDEX idx_products_sale_status ON products(sale_status);
CREATE INDEX idx_products_purchased_at ON products(purchased_at);
CREATE INDEX idx_products_created_at ON products(created_at DESC);
CREATE INDEX idx_products_name ON products USING gin(to_tsvector('simple', name));
CREATE UNIQUE INDEX uq_products_code ON products(code);
CREATE UNIQUE INDEX uq_loose_stones_code ON loose_stones(code);
CREATE INDEX idx_returns_sale ON product_returns(sale_id);
CREATE INDEX idx_returns_product ON product_returns(product_id);
CREATE INDEX idx_returns_returned_at ON product_returns(returned_at);
CREATE INDEX idx_product_sales_loose_stone ON product_sales(loose_stone_id);
CREATE INDEX idx_item_loans_product ON item_loans(product_id);
CREATE INDEX idx_item_loans_loose_stone ON item_loans(loose_stone_id);
CREATE INDEX idx_item_loans_returned ON item_loans(returned_at);
```

---

## 三、系统架构

### 3.1 整体架构

```
【用户浏览器】
      ↕ HTTPS
【宿主机 Nginx】  终止 TLS，client_max_body_size 12M
      ↕ http://127.0.0.1:3000
┌─────────────── Docker Compose 网络 ───────────────┐
│ web        Next.js standalone（页面 + API Routes） │
│              ↓ SUPABASE_URL=http://gateway        │
│ gateway    nginx，把 /rest/v1/* 重写到 PostgREST 根 │
│              ↓                                     │
│ postgrest  PostgREST v12，校验 JWT 并按 role 切角色 │
│              ↓                                     │
│ db         PostgreSQL 16，数据卷 db-data          │
└───────────────────────────────────────────────────┘
      ↕ HTTPS（服务端直传）
【腾讯云 COS】产品图片 / 认证报告
```

只有 `web` 映射端口，且绑定在 `127.0.0.1`，其余三个容器不对外暴露。数据库访问一律在服务端以 `service_role` 完成，浏览器从不直连 PostgREST。

### 3.2 项目目录结构

```
jewelry-system/
├── app/                              # Next.js App Router
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx             # 登录页面
│   ├── (dashboard)/
│   │   ├── layout.tsx               # 后台布局（侧边栏+顶部导航）
│   │   ├── page.tsx                 # 仪表盘（数据总览）
│   │   ├── products/
│   │   │   ├── page.tsx             # 产品列表
│   │   │   ├── new/
│   │   │   │   └── page.tsx         # 新增产品
│   │   │   └── [id]/
│   │   │       └── page.tsx         # 产品详情/编辑
│   │   ├── loose-stones/
│   │   │   └── page.tsx             # 裸石管理（含编辑弹窗）
│   │   ├── scan/
│   │   │   └── page.tsx             # 扫码查询（拍照/选图识别跳转）
│   │   ├── sales/
│   │   │   └── page.tsx             # 销售记录
│   │   ├── customers/
│   │   │   └── page.tsx             # 客户管理
│   │   └── reports/
│   │       └── page.tsx             # 财务报表
│   ├── v/                            # 公开展示页（扫码跳转，免登录）
│   │   └── [type]/
│   │       └── [id]/
│   │           └── page.tsx         # 未登录展示（不含价格）/ 已登录跳编辑
│   └── api/                         # API Routes（运行于自建 Node 容器）
│       ├── products/
│       │   ├── route.ts             # GET 列表 / POST 新增
│       │   └── [id]/
│       │       └── route.ts         # GET 详情 / PATCH 更新 / DELETE 删除
│       ├── sales/
│       │   └── route.ts             # 销售记录 CRUD
│       ├── customers/
│       │   └── route.ts             # 客户 CRUD
│       └── upload/
│           └── route.ts             # 图片/文档上传至腾讯云 COS
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx              # 侧边栏导航
│   │   └── TopNav.tsx               # 顶部导航栏
│   ├── products/
│   │   ├── ProductCard.tsx          # 产品卡片（图片+信息）
│   │   ├── ProductForm.tsx          # 产品新增/编辑表单
│   │   ├── ProductTable.tsx         # 产品列表表格视图
│   │   └── ProductFilters.tsx       # 筛选条件组件
│   ├── ui/
│   │   ├── ImageUpload.tsx          # 多图上传组件
│   │   ├── StatusBadge.tsx          # 销售状态徽标
│   │   └── StatsCard.tsx            # 统计数据卡片
│   └── reports/
│       └── ProfitChart.tsx          # 利润折线图
├── lib/
│   ├── auth.ts                      # 会话 JWT 签发与校验
│   ├── users.ts                     # 账号查询与 bcrypt 密码校验
│   ├── supabase-server.ts           # 服务端数据访问客户端（service_role）
│   ├── supabase-public.ts           # 公开展示页用的受限客户端
│   ├── labels.ts                    # 标签二维码生成与 PDF 导出
│   └── utils.ts                     # 工具函数（格式化金额等）
├── types/
│   └── index.ts                     # TypeScript 类型定义
├── middleware.ts                    # 全站鉴权入口（含 /api）
├── docker/
│   └── gateway.conf                 # /rest/v1 前缀重写
├── supabase/
│   ├── schema.sql                   # 建表脚本（容器首启自动执行）
│   └── init/
│       ├── 00-roles.sh              # 创建 anon/authenticated/service_role/authenticator
│       └── 02-grants.sql            # 表级授权与 PostgREST schema 重载
├── scripts/
│   ├── gen-keys.mjs                 # 生成生产 .env（零依赖）
│   └── backup-db.sh                 # 数据库备份到 COS
├── Dockerfile                       # 三阶段构建，非 root 运行
├── docker-compose.yml               # 四容器编排
├── .env                             # 生产密钥（不提交 Git）
├── .env.local                       # 本地开发变量（不提交 Git）
├── next.config.mjs
├── tailwind.config.ts
└── package.json
```

---

## 四、功能模块设计

### 4.1 仪表盘（Dashboard）

展示关键业务数据概览：

- **统计卡片**
  - 在库产品数量
  - 本月销售额（数据源为 `product_sales` 流水，非 `products` 表；借售未收款不计入；扣除本月退款）
  - 本月利润（成交价 − 进货成本，进货成本按 `purchaseCostOf()` 口径，黄金取进货总成本；扣除本月退款）
  - 未结款总额（**仅统计借售**，在库/已售不计入）
  - 借售中产品数量
- **图表**
  - 近 30 天销售趋势折线图
  - 产品状态分布饼图（在库/已售/借售）
- **待办列表**
  - 未结款超 7 天的订单
  - 借售超 30 天未归还的产品

### 4.2 产品管理模块

#### 产品列表页 `/products`

- 视图切换：卡片视图（含图片预览）/ 表格视图
- 筛选条件：
  - 销售状态（在库/已售/借售）
  - 是否裸石
  - 宝石分类（选项来自 `/api/options` 的历史去重值）
  - 产地
  - 价格区间（最低价 ~ 最高价）
  - 购入时间范围
- 关键词搜索：按产品名称全文搜索
- 排序：价格、购入时间、创建时间（升序/降序）
- **勾选导出/打印**：卡片与表格视图均可逐件勾选（表格表头可全选本页），选中项跨页保留；顶部提示条与两个按钮上实时显示已选件数
- 导出 Excel（首张图片嵌入第一列）与 **标签 PDF**（每个标签含二维码、编号、名称）：**有勾选时仅导出勾选项，未勾选时导出当前筛选条件下的全部数据**
- **点击编号进入编辑**：表格视图中点击产品编号或名称均可进入对应产品的编辑页

#### 产品详情页（只读）`/products/[id]/view`

- 只读展示产品完整信息（含图片画廊、规格、价格、利润、时间等），供快速查看，不提供表单编辑
- 页面右上角提供【编辑】入口，可跳转到编辑页 `/products/[id]`
- 【销售管理】与【借调管理】页面点击产品名称即进入此详情页

#### 产品新增/编辑页 `/products/new` 和 `/products/[id]`

- 多图上传（拖拽或点击），上传至腾讯云 COS
- **认证报告**上传：支持图片与文档（PDF/Word），图片显示缩略图、文档显示文件卡片，可点击查看
- 所有字段均有对应表单控件（详见第六章）
- **重量 + 可输入单位**：重量数字框旁配单位输入（默认「克(g)」，可选「克拉(ct)」或自定义）
- **出售价**字段：记录真实成交出售价格
- 销售状态不在编辑页操作，统一在【销售管理】中变更
- 利润实时预览：填写进货价和售价后立即显示利润
- **结款/未结款仅对借售产品显示**：只有销售状态为【借售】的产品才在编辑页显示结款与未结款字段（未结款 = 价格 − 已结款，红色高亮）；在库/已售产品不显示
- 数字输入框修复：当值为 0 时可正常按 Backspace 删除（NumberInput 组件保留字符串态）
- 删除产品/裸石均需二次确认，防止误删

### 4.3 销售记录模块 `/sales`

- 产品与裸石均可出售：登记销售时选择物品类型（产品/裸石）与出售方式（出售/借售）
- 销售状态统一在【销售管理】中操作，不再在产品/裸石的编辑页变更；提交后自动回写对应物品的销售状态、出售价与出售时间
- **借调中的物品不可出售/借售**：登记销售时的物品下拉列表自动过滤掉正在借调中的产品/裸石；服务端在创建销售记录前也会二次校验，若物品存在未归还的借调记录则拒绝并提示
- **物品选择支持搜索**：登记销售的物品选择器是可折叠的搜索下拉——收起时显示已选物品的编号与名称，展开后顶部为搜索框，按编号或名称/材质实时过滤，点选后自动收起；在库产品逐页拉全（接口单页上限 100），保证搜索覆盖全部在库物品
- **产品下拉悬停预览**：登记销售选择在库产品时，鼠标移到选项上弹出跟随光标的详情卡片（略缩图、名称、重量+单位、尺寸、镶嵌配石、宝石分类、功能分类），空字段自动省略；卡片挂载到 `body` 并 `fixed` 定位以避开下拉框裁切，触屏（`md` 以下）不显示
- 按时间范围查看销售流水，每条记录显示：物品信息、类型（产品/裸石）、客户、成交价、付款方式、成交时间，可修改与删除（删除后物品恢复为【在库】）
- **排序**：按成交时间倒序；成交时间是日期粒度，同一天的多笔再按录入时间倒序
- **点击产品名称查看详情**：销售流水中点击产品名称可打开对应产品的**只读详情页** `/products/[id]/view`，便于查看（裸石无独立详情页，显示为纯文本）
- 付款状态跟踪：支持记录部分付款
- **退货管理**：在销售页登记退货（关联某笔销售，自动带出产品/客户/退款金额），可编辑、可删除；登记后产品自动恢复为【在库】
- 时间段汇总：总销售额（已扣除退款）、总利润、平均客单价

### 4.4 借调管理模块 `/loans`

- 产品与裸石均可借调：登记借出时选择物品类型与具体物品（自动过滤已出售、已借调中的物品）
- **已售的物品不可借调**：借调登记的物品下拉列表仅显示在库且未借调的物品；服务端在创建借调记录前也会二次校验——已售产品/裸石、或已存在未归还借调记录的物品将被拒绝并提示
- 必填借出人，可填联系方式、借出日期、预计归还日期、备注
- 统计卡片：借调总数 / 借出中 / 已归还
- 列表支持【归还】（标记 returned_at）与【删除】（带二次确认）
- 若某产品/裸石存在未归还记录，会在其列表/卡片/表格中显示【借调中】徽标
- **点击产品名称查看详情**：借调列表中点击产品名称可打开对应产品的**只读详情页** `/products/[id]/view`，便于查看（裸石无独立详情页）

> **销售与借调互斥**：已售出的物品不可再借调，借调中的物品不可出售/借售；该约束在前端列表过滤与服务端接口校验中双向强制执行。

### 4.5 回收管理模块 `/recycles`

登记回收进来的旧料，字段与交互：

- **分类**：黄金 / 宝石（下拉二选一）
- **日期**：默认当天，可改
- **关联产品**：可多选，选择器带搜索框（按编号或产品名称过滤）与悬停预览（复用 `ProductHoverPreview`，显示略缩图、名称、重量、尺寸、镶嵌配石、宝石分类、功能分类）；已选产品以标签形式展示，可单个移除
- **备注**：多行文本，可选填
- 列表按日期倒序展示，统计卡片显示回收总数 / 黄金 / 宝石数量，支持编辑与删除（删除带二次确认）
- 关联产品在列表中显示为可点击标签，跳转到产品只读详情页

### 4.6 客户管理模块 `/customers`

- 客户档案：姓名、电话、微信、备注，支持新增/编辑/删除（删除带二次确认）
- 购买历史：点击客户查看其所有购买记录
- 欠款客户快速筛选

### 4.7 财务报表模块 `/reports`

| 报表名称 | 内容说明 |
|----------|----------|
| 利润统计报表 | 按月/季/年统计利润，对比环比增长 |
| 未结款汇总 | 列出借售中未完全收款记录，支持催款标记 |
| 已售产品利润明细 | 全部成交流水的逐笔明细（编号、名称、出售时间、出售价、进货成本、利润），支持按编号/名称搜索，实时汇总件数、出售价合计与利润合计 |
| 在库总成本 | 当前在库物品的进货成本合计 |
| 借售产品追踪 | 所有借售产品状态、借出时间 |
| 产品周转分析 | 平均库存周转天数，快销/滞销产品识别；快销表的利润与滞销表的进货成本均按下表口径计算 |

**成本与利润口径**（页面标题旁的「?」悬停即可查看，实现于 `purchaseCostOf()`）：

> 销售额与利润统一以 `product_sales` 流水为数据源（`products` 表只保留最后一次成交，退货后重卖会丢历史）；借售未收款不计入。库存成本、周转分析仍基于 `products` 表当前状态。

| 分类 | 进货成本 | 利润 |
|------|----------|------|
| 黄金 | 进货总成本 = 进货价(g/元)×重量 + 工费成本(g/元)×重量 + 附加费×买入折扣 | 出售价 − 进货总成本 |
| 其他 | 进货价 | 出售价 − 进货价 |

---

### 4.7 标签打印与扫码查询模块

为方便实体库存盘点与快速取件，产品与裸石均支持二维码标签打印与扫码定位。

#### 标签打印

- 在【产品管理】与【裸石管理】列表页点击「标签 PDF」按钮，为当前列表中的全部条目生成标签（产品列表支持先勾选再打印，有勾选时只生成勾选项）；产品编辑页与裸石编辑弹窗也可为当前单个物品生成标签
- 版式针对 **Godex G530 的 30×25mm 对折标**，折痕在 30mm 正中，内容不跨越折痕；**两面内容各自逆时针旋转 90°**，文字沿标签长边排布，每面可用区域为 25mm(宽) × 15mm(高)：
  - **左面**：二维码 12×12mm（编码指向公开展示页 `/v/<p|s>/<id>`，`p` = 产品，`s` = 裸石），右侧打印**售价**
  - **右面**：产品名称（最多 2 行自动折行），下方依次为尺寸、产地、重量（含单位）、镶嵌配石（最多 2 行自动折行）、工费（前缀 `工费：`）、附加费（前缀 `F：`），其余字段只打印值本身
  - **字段为空或为 0 时整行省略**，写满该面即止
- 每张标签独占一页，页面尺寸即标签尺寸，打印时选 Godex 驱动、缩放设为「实际大小 / 100%」直接出纸
- 二维码生成与 PDF 输出均在客户端完成（`lib/labels.ts` 使用 `qrcode` + `jspdf`），标签内容经 canvas 以 12px/mm 渲染后嵌入 PDF，避免 jsPDF 内置字体的中文乱码
- `productLabelItem()` / `stoneLabelItem()` 统一把产品/裸石转换成标签数据，各调用点不再各自拼字段

#### 扫码查询 `/scan`

> 已从侧边栏/移动端导航中移除（手机相机直扫不经过该页），路由保留，可直接访问。

- 采用「拍照/选图识别」方式：点击大按钮调起手机原生相机拍照或从相册选取二维码图片，再用 `html5-qrcode` 的 `scanFile` 解码（原生相机对焦更好，识别更稳定，已移除实时摄像头扫描）
- 识别成功后进入公开展示页 `/v/<p|s>/<id>`，根据登录状态自动分流：
  - **已登录**：跳转对应编辑页（产品 `/products/[id]`，裸石 `/loose-stones?edit=[id]`）
  - **未登录**（手机相机直扫）：进入清新美观的展示页，**不显示任何价格**，支持多图展示与缩略图切换、点击图片全屏放大，展示名称、编号与规格
- 公开展示页 `/v` 在中间件中放行，无需登录即可访问
- 二维码内容同时兼容旧版 `/scan?t=&id=` 与纯文本 `p:<id>` / `s:<id>`，便于扩展
- 仅需相机/相册权限，无 HTTPS 摄像头限制，识别更通用稳定

#### 公开展示主页 `/v`

- 无需登录即可浏览完整目录，产品与裸石按创建时间倒序合并展示，**含已售商品**，同样**不显示任何价格**
- 支持「全部 / 产品 / 裸石」切换与按编号、名称检索；点击卡片打开全屏预览，支持缩略图切换、左右方向键与 Esc 关闭
- 服务端每类最多取 500 条作为公开接口的保护上限；查询失败直接抛错，不会伪装成空目录

---

### 4.8 认证与账号管理模块 `/users`

系统采用**自建用户名登录**，不再依赖 Supabase Auth：

- **登录**：用户名 + 密码（`/login` → `POST /api/auth/login`）。后端在 `app_users` 表中按用户名查账号，用 bcrypt 校验密码；成功后用 jose 签发 HS256 JWT，写入 httpOnly Cookie（`auth_token`，有效期 7 天）
- **登录页交互**：页面加载后自动聚焦用户名输入框；点击登录后按钮保持禁用并显示「登录中...」，直到成功跳转主页完成，避免重复提交
- **会话校验**：`middleware.ts` 在 Edge 运行时用 jose 校验 Cookie 中的 JWT；未登录跳 `/login`（`/v/` 公开页除外）
- **角色**：`super_admin`（超级管理员）/ `user`（普通用户）
- **账号管理页 `/users`**：仅 `super_admin` 可见与访问，可新增账号、删除账号（不可删除当前登录账号）、重置密码、设置角色
- **初始超级管理员**：仓库不内置任何账号。当 `app_users` 为空且配置了 `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` 时，首次登录会据此创建超管；未配置则不创建，**没有默认密码**。密码由 `scripts/gen-keys.mjs` 随机生成写入 `.env`，登录后应立即在后台修改并从 `.env` 删除这两行
- **密码安全**：仅存储 bcrypt 哈希，登录失败统一提示「用户名或密码错误」，避免暴露账号是否存在
- `app_users` 表启用 RLS 且不设任何 policy，仅服务端 service_role 可读写

> 部署提示：生产环境请在平台环境变量中配置 `AUTH_SECRET`（JWT 签名密钥），缺失时回退到内置开发密钥，存在安全风险。

---


## 五、API 接口设计

### 5.1 接口总览

| 方法 | 路径 | 功能 | 说明 |
|------|------|------|------|
| GET | /api/products | 获取产品列表 | 支持分页、筛选、搜索 |
| POST | /api/products | 创建产品 | 含图片 URL 数组 |
| GET | /api/products/[id] | 产品详情 | 获取单个产品完整信息 |
| PATCH | /api/products/[id] | 更新产品 | 部分更新 |
| DELETE | /api/products/[id] | 删除产品 | 软删除 |
| POST | /api/upload | 上传文件 | 上传图片/认证报告文档至腾讯云 COS，返回 URL |
| GET | /api/sales | 获取销售记录 | 含产品/裸石关联，支持时间范围筛选 |
| POST | /api/sales | 创建销售记录 | 物品为产品或裸石，同时更新其销售状态与出售价；**借调中的物品拒绝出售** |
| PATCH | /api/sales/[id] | 修改销售记录 | 同步回写物品成交价/状态/时间 |
| DELETE | /api/sales/[id] | 删除销售记录 | 物品恢复为【在库】 |
| GET | /api/customers | 客户列表 | |
| POST | /api/customers | 创建客户 | |
| PATCH | /api/customers/[id] | 更新客户 | 部分更新 |
| DELETE | /api/customers/[id] | 删除客户 | 前端二次确认 |
| GET | /api/loose-stones | 裸石列表 | 含 is_used / is_loaned 派生状态，支持筛选、搜索 |
| POST | /api/loose-stones | 创建裸石 | |
| PATCH | /api/loose-stones/[id] | 更新裸石 | 部分更新 |
| DELETE | /api/loose-stones/[id] | 删除裸石 | 前端二次确认 |
| GET | /api/returns | 获取退货记录 | 含产品/客户关联，支持时间、客户筛选 |
| POST | /api/returns | 登记退货 | 同时将产品恢复为【在库】 |
| PATCH | /api/returns/[id] | 更新退货 | 部分更新 |
| DELETE | /api/returns/[id] | 删除退货 | |
| GET | /api/loans | 获取借调记录 | 含产品/裸石关联，支持 active/returned 状态筛选 |
| POST | /api/loans | 登记借出 | 物品为产品或裸石；**已售或已借调中的物品拒绝借出** |
| PATCH | /api/loans/[id] | 更新/归还借调 | 填写 returned_at 即标记归还 |
| DELETE | /api/loans/[id] | 删除借调记录 | |
| GET | /api/recycles | 获取回收记录 | 按日期倒序 |
| POST | /api/recycles | 登记回收 | 分类/日期/关联产品数组/备注 |
| PATCH | /api/recycles/[id] | 更新回收记录 | 部分更新 |
| DELETE | /api/recycles/[id] | 删除回收记录 | |
| POST | /api/auth/login | 登录 | 用户名+密码校验，签发 JWT Cookie；首次自动兜底建超管 |
| POST | /api/auth/logout | 退出登录 | 清除会话 Cookie |
| GET | /api/auth/me | 当前登录信息 | 返回 id/用户名/角色，未登录返回 401 |
| GET | /api/auth/users | 账号列表 | **仅超管** |
| POST | /api/auth/users | 新增账号 | **仅超管**，密码 bcrypt 存储 |
| PATCH | /api/auth/users/[id] | 改密码/角色/启停 | **仅超管** |
| DELETE | /api/auth/users/[id] | 删除账号 | **仅超管**，禁止删除自己 |

### 5.2 查询参数（GET /api/products）

| 参数名 | 类型 | 说明 |
|--------|------|------|
| page | number | 页码，默认 1 |
| limit | number | 每页数量，默认 20，最大 100 |
| status | string | in_stock / sold / consignment |
| is_loose_stone | boolean | 是否裸石筛选 |
| gemstone_category | string | 宝石分类精确匹配 |
| search | string | 产品名称关键词 |
| price_min | number | 最低价格 |
| price_max | number | 最高价格 |
| sort_by | string | price / created_at / purchased_at |
| order | string | asc / desc |

### 5.3 核心代码示例

#### `lib/supabase.ts` — 客户端初始化

```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)
```

#### `lib/supabase-server.ts` — 服务端客户端（API Routes 用）

```typescript
import { createClient } from '@supabase/supabase-js'

export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,  // 服务端使用 service role key
    {
      // 注入 no-store fetch，绕过 Next.js Data Cache，避免读到陈旧数据
      // （修复图片删除后重现、仪表盘数据不同步等问题）
      global: {
        fetch: (input, init) =>
          fetch(input as RequestInfo, { ...init, cache: 'no-store' }),
      },
    }
  )
}
```

#### `types/index.ts` — TypeScript 类型定义

```typescript
export type SaleStatus = 'in_stock' | 'sold' | 'consignment'

export interface Product {
  id: string
  code: string | null
  image_urls: string[]
  name: string
  total_weight: number | null
  weight_unit: string | null        // 重量单位，默认“克(g)”
  size: string | null
  origin: string | null
  inlaid_stones: string | null
  certificate_urls: string[]        // 认证报告（图片/文档）
  gemstone_category: string | null   // 自由文本，按历史值模糊补全
  function_category: string | null   // 自由文本，按历史值模糊补全
  source_loose_stone_id: string | null
  price: number
  purchase_price: number
  sale_price: number                 // 出售价
  sale_status: SaleStatus
  settled_amount: number
  unsettled_amount: number   // 数据库自动计算
  is_consignment: boolean
  is_loose_stone: boolean
  is_loaned?: boolean        // 派生：是否借调中
  profit: number             // 数据库自动计算
  purchased_at: string | null
  sold_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  name: string
  phone: string | null
  wechat: string | null
  notes: string | null
  created_at: string
}

export interface LooseStone {
  id: string
  code: string | null
  image_urls: string[]
  material: string | null        // 产品名称
  size: string | null
  weight: number | null
  weight_unit: string | null         // 重量单位，默认“克(g)”
  price: number
  gemstone_category: string | null   // 自由文本
  origin: string | null              // 产地
  certificate: string | null         // 证书
  certificate_urls: string[]         // 认证报告（图片/文档）
  sale_status: SaleStatus            // 销售状态
  purchase_price: number             // 进货价
  sale_price: number                 // 售出价
  purchased_at: string | null        // 购入时间
  sold_at: string | null             // 卖出时间
  notes: string | null
  is_used?: boolean                  // 派生：是否已用于产品
  is_loaned?: boolean                // 派生：是否借调中
  created_at: string
  updated_at: string
}

export interface ProductSale {
  id: string
  product_id: string | null
  loose_stone_id: string | null
  customer_id: string | null
  sale_price: number
  payment_method: string | null
  sold_at: string
  created_at: string
}

export interface ProductReturn {
  id: string
  sale_id: string | null
  product_id: string | null
  customer_id: string | null
  refund_amount: number
  reason: string | null
  returned_at: string
  created_at: string
}

export interface ItemLoan {
  id: string
  product_id: string | null
  loose_stone_id: string | null
  borrower_name: string
  borrower_contact: string | null
  loaned_at: string
  due_at: string | null
  returned_at: string | null      // 为空表示借出中
  notes: string | null
  created_at: string
}
```

#### `app/api/products/route.ts` — 产品列表 & 新增

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const page = Number(searchParams.get('page') || 1)
  const limit = Number(searchParams.get('limit') || 20)
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const is_loose_stone = searchParams.get('is_loose_stone')
  const price_min = searchParams.get('price_min')
  const price_max = searchParams.get('price_max')
  const sort_by = searchParams.get('sort_by') || 'created_at'
  const order = searchParams.get('order') || 'desc'

  const supabase = createServerClient()

  let query = supabase
    .from('products')
    .select('*', { count: 'exact' })

  if (status) query = query.eq('sale_status', status)
  if (search) query = query.ilike('name', `%${search}%`)
  if (is_loose_stone !== null) query = query.eq('is_loose_stone', is_loose_stone === 'true')
  if (price_min) query = query.gte('price', Number(price_min))
  if (price_max) query = query.lte('price', Number(price_max))

  query = query
    .order(sort_by, { ascending: order === 'asc' })
    .range((page - 1) * limit, page * limit - 1)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    data,
    total: count,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('products')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data }, { status: 201 })
}
```

#### `app/api/products/[id]/route.ts` — 产品详情、更新、删除

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ data })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  const supabase = createServerClient()

  const { data, error } = await supabase
    .from('products')
    .update(body)
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerClient()

  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

#### `app/api/upload/route.ts` — 图片上传

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  // 限制：允许图片与文档（PDF/Word），最大 10MB
  const allowedTypes = [
    'image/jpeg', 'image/png', 'image/webp',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ]
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: '只支持图片或 PDF/Word 文档' }, { status: 400 })
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: '文件大小不能超过 10MB' }, { status: 400 })
  }

  const supabase = createServerClient()
  const ext = file.name.split('.').pop()
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { error } = await supabase.storage
    .from('product-images')
    .upload(filename, file, { contentType: file.type })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage
    .from('product-images')
    .getPublicUrl(filename)

  return NextResponse.json({ url: publicUrl })
}
```

---

## 六、前端页面设计

### 6.1 页面路由总览

| 路由路径 | 页面名称 | 核心功能 |
|----------|----------|----------|
| /login | 登录页 | 用户名 + 密码登录（自建 JWT 鉴权） |
| / | 仪表盘 | 数据总览、快捷操作、待办事项 |
| /products | 产品列表 | 多视图浏览、筛选、搜索 |
| /products/new | 新增产品 | 完整产品录入表单 + 图片上传 |
| /products/[id] | 产品编辑 | 编辑产品信息 |
| /products/[id]/view | 产品详情（只读） | 只读查看产品完整信息，提供【编辑】入口；销售/借调页点击产品名进入 |
| /loose-stones | 裸石管理 | 裸石多视图浏览、筛选、状态展示（点击编号/名称可编辑） |
| /scan | 扫码查询 | 拍照或选取标签二维码图片，自动跳转对应产品/裸石（不在导航菜单中） |
| /v/[type]/[id] | 扫码展示页 | 公开页：已登录跳转编辑页，未登录显示不含价格的商品展示 |
| /sales | 销售记录 | 销售流水、付款跟踪、退货登记 |
| /loans | 借调管理 | 借出登记、归还、借调状态追踪 |
| /recycles | 回收管理 | 回收旧料登记，可关联多件产品 |
| /customers | 客户管理 | 客户档案、购买历史 |
| /reports | 财务报表 | 多维度统计图表、导出功能 |
| /users | 账号管理 | **仅超级管理员**：新增/删除账号、重置密码、设置角色 |

> **载入体验**：后台（`(dashboard)` 路由组）配置了 `loading.tsx`，利用 Next.js App Router 的自动 Suspense 机制，在服务端取数期间（登录后首次进入、页面跳转、网络较慢时）展示骨架屏——标题栏、统计卡片、列表行占位动画与「正在加载…」提示，侧边栏与顶部导航保持不变。

### 6.2 产品表单字段映射

| 表单字段 | 控件类型 | 交互说明 |
|----------|----------|----------|
| 产品图片 | 图片上传组件 | 拖拽/点击上传，多图预览，支持删除、调整顺序、设为首图（首图带「首图」徽章），显示上传进度 |
| 认证报告 | 文件上传组件 | 支持图片与文档（PDF/Word）；图片显示缩略图、文档显示文件卡片，可点击查看 |
| 产品名称 | 文本输入 | 必填，最多 255 字符 |
| 重量 | 数字输入 + 单位输入 | 重量保留 3 位小数；单位默认「克(g)」，可选「克拉(ct)」或自定义 |
| 尺寸 | 文本输入 | 如：戒指12号、手链18cm，可选填 |
| 产地 | 下拉选择 + 自定义输入 | 预设常用产地，支持手动输入 |
| 镶嵌配石 | 多行文本域 | 描述主石、配石详情 |
| 宝石分类 | 下拉选择 | 翡翠 / 蓝宝，可选填 |
| 功能分类 | 下拉选择 | 吊坠 / 项链 / 手镯，可选填 |
| 从现有裸石生产 | 开关 + 下拉选择 | 勾选后可选择一颗已录入的裸石作为加工来源 |
| 价格 | 数字输入 | 人民币，前缀 ¥，必填 |
| 进货价 | 数字输入 | 用于自动计算利润，仅内部可见 |
| 出售价 | 数字输入 | 真实成交出售价格 |
| 结款 | 数字输入 | 已收款额，实时显示未结款余额（**仅借售产品显示**） |
| 未结款 | 只读计算字段 | 自动 = 价格 - 结款，红色高亮（**仅借售产品显示**） |
| 利润 | 只读计算字段 | 自动 = 价格 - 进货价，绿色显示 |
| 购入时间 | 日期选择器 | 记录购入日期 |
| 备注 | 多行文本域 | 可选填 |

> **销售状态**不在产品/裸石编辑页操作，统一在【销售管理】中变更。所有数字输入框采用 NumberInput 组件，修复了值为 0 时无法按 Backspace 删除的问题。

### 6.3 核心组件示例

#### `components/ui/StatusBadge.tsx`

```tsx
const STATUS_MAP = {
  in_stock:     { label: '在库',  color: 'bg-green-100 text-green-800' },
  sold:         { label: '已售',  color: 'bg-gray-100 text-gray-600' },
  consignment:  { label: '借售',  color: 'bg-yellow-100 text-yellow-800' },
}

export function StatusBadge({ status }: { status: string }) {
  const { label, color } = STATUS_MAP[status as keyof typeof STATUS_MAP]
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  )
}
```

#### `components/products/ProductCard.tsx`

```tsx
import Image from 'next/image'
import { Product } from '@/types'
import { StatusBadge } from '@/components/ui/StatusBadge'

export function ProductCard({ product }: { product: Product }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
      {/* 产品图片 */}
      <div className="aspect-square relative bg-gray-50">
        {product.image_urls[0] ? (
          <Image src={product.image_urls[0]} alt={product.name} fill className="object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300 text-4xl">💎</div>
        )}
      </div>
      {/* 产品信息 */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-medium text-gray-900 text-sm line-clamp-2">{product.name}</h3>
          <StatusBadge status={product.sale_status} />
        </div>
        <p className="text-lg font-bold text-amber-700 mt-1">¥{product.price.toLocaleString()}</p>
        <div className="flex gap-3 mt-2 text-xs text-gray-500">
          {product.total_weight && <span>{product.total_weight}g</span>}
          {product.origin && <span>{product.origin}</span>}
          {product.is_loose_stone && <span className="text-blue-600">裸石</span>}
        </div>
        {product.sale_status === 'consignment' && product.unsettled_amount > 0 && (
          <p className="text-xs text-red-500 mt-1">未结款：¥{product.unsettled_amount.toLocaleString()}</p>
        )}
      </div>
    </div>
  )
}
```

---

## 七、部署流程

### 步骤一：服务器准备

腾讯云轻量应用服务器，Ubuntu 24.04，2C2G 起步（构建 Next.js 时内存峰值较高，1G 会 OOM）。

```bash
# 默认用户是 ubuntu，不是 root/deploy
sudo usermod -aG docker ubuntu   # 加完需退出重新登录才生效
docker version                    # 验证免 sudo 可用
```

在**控制台**的防火墙里放通 TCP `80` 和 `443`。轻量服务器的防火墙在云平台侧，默认只开 22，在系统里改 `ufw` 不起作用。

### 步骤二：获取代码与生成密钥

```bash
sudo mkdir -p /opt/jewelry
sudo chown -R ubuntu:ubuntu /opt/jewelry
cd /opt/jewelry
git clone <仓库地址> .

# 生成全部生产密钥
node scripts/gen-keys.mjs > .env.new
mv .env.new .env && chmod 600 .env
```

`scripts/gen-keys.mjs` 只用 `node:crypto`，**不依赖任何三方包**。它是部署第一步就要跑的引导脚本，此时服务器上往往还没有 `node_modules`，也不应为它装。

先写 `.env.new` 再改名，是为了避免脚本报错时 shell 已经把 `.env` 截成空文件。

它会输出：

| 变量 | 用途 |
|---|---|
| `POSTGRES_PASSWORD` | postgres 超级用户密码 |
| `AUTHENTICATOR_PASSWORD` | PostgREST 连库的 `authenticator` 角色密码 |
| `JWT_SECRET` | PostgREST 校验 Bearer token 的密钥 |
| `ANON_KEY` / `SERVICE_ROLE_KEY` | 由 `JWT_SECRET` 签发的 HS256 token，`role` 声明决定数据库角色 |
| `AUTH_SECRET` | 应用会话 Cookie 的签名密钥，**与 `JWT_SECRET` 无关，不要复用** |
| `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` | 首次登录时创建超管用的账号密码，密码每次生成都不同 |

### 步骤三：配置对象存储

在腾讯云 COS 创建存储桶：

1. 权限选 **私有读写**，不要选公有读
2. 在【权限管理 → 存储桶策略】只给 `product-images/*` 前缀开匿名 `cos:GetObject`，其余路径保持私有
3. 在 CAM 创建子账号，仅授予该桶的读写权限，取得 SecretId / SecretKey

把四项填进 `.env`：

```env
COS_REGION=ap-guangzhou
COS_BUCKET=jewelry-1300000000    # 必须带 APPID 后缀
COS_SECRET_ID=AKID...
COS_SECRET_KEY=...
COS_PUBLIC_BASE_URL=             # 可选，绑了 CDN 自定义域名才填
```

检查没有遗漏（除 `COS_PUBLIC_BASE_URL` 外不应有输出）：

```bash
grep -E '^[A-Z_]+=$' .env
```

### 步骤四：构建并启动

```bash
docker compose up -d --build
```

逐层验证，别一上来就试浏览器：

```bash
docker compose ps                                     # 四个容器均应 running
docker compose logs db | grep -iE "error|fatal"
docker compose exec db psql -U postgres -d jewelry -c '\dt'   # 应列出业务表
docker compose logs postgrest

# 持 service_role token 直接问 PostgREST
set -a && source .env && set +a
docker compose exec gateway wget -qO- \
  --header="Authorization: Bearer $SERVICE_ROLE_KEY" \
  "http://postgrest:3000/products?limit=1"

curl -I http://127.0.0.1:3000                         # 200 或 307 即正常
```

常见故障：

| 现象 | 原因与处置 |
|---|---|
| PostgREST 返回 401 `JWSError` | `JWT_SECRET` 与签发 token 的不一致，`docker compose up -d --force-recreate postgrest` |
| 返回 404 | 表不存在或未授权，查 `02-grants.sql` 是否执行 |
| `password authentication failed` 或 `role "authenticated" does not exist` | 数据卷是用旧密码初始化的。初始化脚本**仅在卷为空时执行一次**，需 `docker compose down -v` 后重建（会清空数据） |

### 步骤五：宿主机 Nginx 与 HTTPS

`web` 只监听 `127.0.0.1:3000`，公网流量必须经宿主机 Nginx 进来：

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    client_max_body_size 12M;   # 上传上限 10MB，留出 multipart 编码开销

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }
}
```

`X-Forwarded-Proto` 不能缺——Next.js 靠它判断外部是否为 HTTPS，否则重定向会退化成 `http://`。

证书用 `sudo certbot --nginx -d your-domain.com` 签发。

> **大陆节点必须先完成 ICP 备案**，否则运营商会拦截 80/443 上的域名访问，certbot 的 HTTP-01 验证也会失败。备案期间可先用 IP + 自签证书跑起来（自签证书的 `subjectAltName` 必须写 `IP:x.x.x.x`，否则 Chrome 不给“继续访问”入口）。
>
> 注意登录 Cookie 带 `secure` 标志（生产环境下），**纯 HTTP 访问会导致登录后立即被踢回登录页**，因此即使临时方案也必须上 HTTPS。

### 步骤六：上线前加固

1. **首次登录后立即修改超管密码**，并把 `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` 从 `.env` 删除（账号已存在后它们不再生效）
2. 确认匿名访问被拦：`curl -i https://your-domain.com/api/customers` 应返回 `401`
3. 配置定时备份：`scripts/backup-db.sh` 用 `coscli` 把 `pg_dump` 产物传到 COS，加入 crontab

```bash
0 3 * * * cd /opt/jewelry && ./scripts/backup-db.sh >> /var/log/jewelry-backup.log 2>&1
```

### 代码更新

```bash
cd /opt/jewelry
git pull
docker compose up -d --build
```

数据卷 `db-data` 不受重建影响。若改了 `schema.sql`，需手写迁移 SQL 并用 `docker compose exec db psql` 执行——`docker-entrypoint-initdb.d` 里的脚本只在卷为空时跑一次。

> **国内服务器访问 GitHub / Docker Hub 可能超时。** 若 `git pull` 卡住，可把仓库同步一份到 Gitee 或腾讯云 CODING；若拉镜像失败，在 `/etc/docker/daemon.json` 配 `registry-mirrors` 指向 `https://mirror.ccs.tencentyun.com`（腾讯云内网可达）。

### 成本估算

| 项目 | 规格 | 月费用 |
|------|------|--------|
| 腾讯云轻量应用服务器 | 2C2G 4M 带宽 | 约 ¥60（包年更低） |
| 腾讯云 COS | 存储 + 外网下行流量 | 小店体量通常 <¥5 |
| 域名 | `.top` 续费 | 约 ¥5/月 |
| SSL 证书 | Let's Encrypt | ¥0 |
| **合计** | | **约 ¥70/月** |

数据库、认证、REST 层均为自托管，不随用量增长产生额外订阅费用；代价是需要自己负责备份与升级。

---

## 八、安全与权限设计

### 8.1 数据库角色与授权

容器首次启动时，`supabase/init/00-roles.sh` 创建与 Supabase 同名的四个角色：

| 角色 | 用途 | 授权 |
|---|---|---|
| `authenticator` | PostgREST 的连库账号，根据 JWT 的 `role` 声明 `SET ROLE` | 无表权限，仅可切换到下面三个角色 |
| `anon` | 未携带有效 token 时的默认角色 | **没有任何表授权** |
| `authenticated` | 预留 | 无 |
| `service_role` | 应用服务端唯一使用的角色 | `GRANT ALL`，带 `BYPASSRLS` |

```sql
-- supabase/init/02-grants.sql（节选）
GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

NOTIFY pgrst, 'reload schema';
```

> **这里有个关键的安全前提需要说清楚。** 项目未使用 RLS 作为安全边界——因为所有数据访问都走 `service_role`，而它 `BYPASSRLS`，RLS 策略对它无效。真正的边界是两道：
>
> 1. `service_role` 密钥只存在于服务端，永不下发浏览器；`postgrest` 容器也不对外暴露端口
> 2. `middleware.ts` 在入口处拦住所有未登录请求，**包括 `/api`**
>
> `anon` 角色不给任何表授权是第三道兜底：即使有人直接触达到 PostgREST，没有有效 token 也读不到任何数据。

### 8.2 API 安全规范

- 所有 API Routes 在服务端使用 `service_role` 密钥，不暴露给前端
- `middleware.ts` 统一校验会话，未登录的 API 请求返回 401，页面请求重定向至 `/login`
- 图片/文档上传限制：单文件最大 10MB，允许 jpg/png/webp 图片及 PDF/Word 文档
- 对象键由 `randomUUID()` 加**根据 MIME 类型推导的扩展名**拼成，用户文件名不参与构造，避免路径穿越与伪造扩展名
- 文档类型强制 `ContentDisposition: attachment`，避免在 COS 域名下直接渲染
- 使用 `zod` 对请求体进行 Schema 校验，防止恶意数据写入
- 登录接口对“用户不存在”与“密码错误”返回同一提示，不泄露账号是否存在
- `AUTH_SECRET` 在生产环境缺失时直接抛错，不退化到默认密钥
- 会话 Cookie 为 `httpOnly` + `sameSite=lax` + 生产环境 `secure`，因此生产必须跑在 HTTPS 下
- Next.js 版本需 ≥ 14.2.25，以修复 CVE-2025-29927（通过 `x-middleware-subrequest` 头绕过 middleware）

### 8.3 `middleware.ts` — 路由鉴权

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { AUTH_COOKIE, verifySession } from '@/lib/auth'

const PUBLIC_API = new Set(['/api/auth/login', '/api/auth/logout'])

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const session = await verifySession(req.cookies.get(AUTH_COOKIE)?.value)

  // API 返回 401，不重定向——重定向会让 fetch 拿到登录页 HTML 而非错误码
  if (pathname.startsWith('/api/')) {
    if (PUBLIC_API.has(pathname) || session) return NextResponse.next()
    return NextResponse.json({ error: '未登录或会话已过期' }, { status: 401 })
  }

  // /v/ 为扫码公开展示页，不含价格，免登录
  if (!session && !pathname.startsWith('/login') && !pathname.startsWith('/v/')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (session && pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

> **matcher 里绝不能再出现 `api|`。** 早期版本沿用了 Next.js 文档里的示例 matcher，它把 `/api` 排除在外。当时只有用户管理接口自己做了权限校验，其余十几个业务路由全部裸奔，且都用 `service_role` 访问数据库——意味着任何人 `curl https://域名/api/customers` 就能拿到全部客户信息，或者直接 `DELETE` 掉任意产品。

---

## 九、开发建议与扩展方向

### 9.1 推荐开发顺序

1. **环境搭建** — `docker compose up -d db postgrest gateway` 起数据层，Next.js 用 `npm run dev` 跑在宿主机
2. **数据库** — 核对 `schema.sql` 建表结果，用 `docker compose exec db psql` 手动测试增删改查
3. **认证** — 实现登录/登出页面，验证 middleware 鉴权生效（含 `/api` 返回 401）
4. **产品 CRUD** — 产品列表、新增、编辑、删除的 API + 页面
5. **图片上传** — 实现多图上传至 COS，集成到产品表单
6. **仪表盘** — 统计数据查询与卡片展示
7. **财务报表** — 图表与数据导出功能

### 9.2 Prompt 建议（给 AI 编码助手）

做 vibe coding 时，可以把此文档喂给 AI 后，配合以下 Prompt：

```
基于此文档，请帮我实现 [具体功能]。
技术栈：Next.js 14 App Router + TypeScript + Tailwind CSS + shadcn/ui，
数据层为自建 PostgreSQL + PostgREST，服务端用 @supabase/supabase-js 以 service_role 访问。
请严格按照文档中的类型定义、API 路径和数据库字段命名。
```

### 9.3 后续扩展方向

- **移动端适配** — 使用 Tailwind 响应式类，支持手机端浏览管理
- **路由级鉴权** — 目前鉴权是**单点**，全压在 middleware 上。建议在各业务路由内再加一道会话校验作为纵深防御
- **条码/二维码** — 每件产品生成唯一 QR Code，扫码快速查询库存
- **Excel 导出** — 使用 `exceljs` 库导出产品/裸石库存清单（首张图片嵌入第一列），`xlsx` 用于财务报表
- **消息提醒** — 未结款超期自动提醒
- **多用户角色** — 当前区分超管与普通用户，可进一步细化到字段级权限
- **数据备份** — `scripts/backup-db.sh` 定时 `pg_dump` 并上传至 COS，建议额外保留一份异地副本

---

*珠宝黄金销售管理系统 · 技术设计文档 v2.0*
