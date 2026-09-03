-- ============================================================
-- 珠宝黄金销售管理系统 — 数据库建表脚本
-- 在 Supabase SQL Editor 中执行
-- ============================================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 销售状态枚举
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sale_status_enum') THEN
    CREATE TYPE sale_status_enum AS ENUM (
      'in_stock',       -- 在库
      'sold',           -- 已售
      'consignment'     -- 借售
    );
  END IF;
END$$;

-- 宝石分类枚举
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gemstone_category_enum') THEN
    CREATE TYPE gemstone_category_enum AS ENUM (
      'jade',           -- 翡翠
      'sapphire'        -- 蓝宝
    );
  END IF;
END$$;

-- 功能分类枚举
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'product_function_enum') THEN
    CREATE TYPE product_function_enum AS ENUM (
      'pendant',        -- 吊坠
      'necklace',       -- 项链
      'bracelet'        -- 手镯
    );
  END IF;
END$$;

-- ------------------------------------------------------------
-- 裸石表（products 可由裸石加工生产）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loose_stones (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code               VARCHAR(20),
  image_urls         TEXT[] DEFAULT '{}',
  size               VARCHAR(100),
  material           VARCHAR(100),
  weight             DECIMAL(10,3),
  price              DECIMAL(12,2) DEFAULT 0,
  gemstone_category  VARCHAR(100),
  origin             VARCHAR(100),
  certificate        VARCHAR(255),
  purchase_price     DECIMAL(12,2) DEFAULT 0,
  sale_price         DECIMAL(12,2) DEFAULT 0,
  purchased_at       DATE,
  sold_at            DATE,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- 裸石追加新字段（幂等）
ALTER TABLE loose_stones ADD COLUMN IF NOT EXISTS origin         VARCHAR(100);
ALTER TABLE loose_stones ADD COLUMN IF NOT EXISTS certificate    VARCHAR(255);
ALTER TABLE loose_stones ADD COLUMN IF NOT EXISTS purchase_price DECIMAL(12,2) DEFAULT 0;
ALTER TABLE loose_stones ADD COLUMN IF NOT EXISTS sale_price     DECIMAL(12,2) DEFAULT 0;
ALTER TABLE loose_stones ADD COLUMN IF NOT EXISTS purchased_at   DATE;
ALTER TABLE loose_stones ADD COLUMN IF NOT EXISTS sold_at        DATE;

-- ------------------------------------------------------------
-- 产品主表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code             VARCHAR(20),
  image_urls       TEXT[] DEFAULT '{}',
  name             VARCHAR(255) NOT NULL,
  total_weight     DECIMAL(10,3),
  size             VARCHAR(100),
  origin           VARCHAR(100),
  inlaid_stones    TEXT,
  gemstone_category VARCHAR(100),
  function_category VARCHAR(100),
  source_loose_stone_id UUID REFERENCES loose_stones(id) ON DELETE SET NULL,
  price            DECIMAL(12,2) NOT NULL DEFAULT 0,
  purchase_price   DECIMAL(12,2) DEFAULT 0,
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

-- 已有数据库追加尺寸字段（幂等）
ALTER TABLE products ADD COLUMN IF NOT EXISTS size VARCHAR(100);

-- 已有数据库追加宝石分类 / 功能分类 / 裸石来源字段（幂等）
ALTER TABLE products ADD COLUMN IF NOT EXISTS gemstone_category VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS function_category VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS source_loose_stone_id UUID;

-- 将分类字段由枚举改为自由文本（幂等，可重复执行）
ALTER TABLE products      ALTER COLUMN gemstone_category TYPE VARCHAR(100) USING gemstone_category::text;
ALTER TABLE products      ALTER COLUMN function_category TYPE VARCHAR(100) USING function_category::text;
ALTER TABLE loose_stones  ALTER COLUMN gemstone_category TYPE VARCHAR(100) USING gemstone_category::text;

-- 裸石追加图片字段（幂等）
ALTER TABLE loose_stones ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

-- 产品 / 裸石编号字段（幂等）
ALTER TABLE products     ADD COLUMN IF NOT EXISTS code VARCHAR(20);
ALTER TABLE loose_stones ADD COLUMN IF NOT EXISTS code VARCHAR(20);

-- 已有数据库补建裸石外键（幂等）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_source_loose_stone_id_fkey'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_source_loose_stone_id_fkey
      FOREIGN KEY (source_loose_stone_id)
      REFERENCES loose_stones(id) ON DELETE SET NULL;
  END IF;
END$$;

-- ------------------------------------------------------------
-- 客户表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       VARCHAR(100) NOT NULL,
  phone      VARCHAR(20),
  wechat     VARCHAR(100),
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 销售记录表
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_sales (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id     UUID REFERENCES products(id) ON DELETE CASCADE,
  customer_id    UUID REFERENCES customers(id) ON DELETE SET NULL,
  sale_price     DECIMAL(12,2) NOT NULL,
  payment_method VARCHAR(50),
  sold_at        DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- 退货记录表（与销售记录关联）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_returns (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sale_id        UUID REFERENCES product_sales(id) ON DELETE SET NULL,
  product_id     UUID REFERENCES products(id) ON DELETE SET NULL,
  customer_id    UUID REFERENCES customers(id) ON DELETE SET NULL,
  refund_amount  DECIMAL(12,2) NOT NULL DEFAULT 0,
  reason         TEXT,
  returned_at    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_returns_sale ON product_returns(sale_id);
CREATE INDEX IF NOT EXISTS idx_product_returns_returned_at ON product_returns(returned_at);

-- ------------------------------------------------------------
-- 新增功能字段：重量单位 / 出售价 / 认证报告 / 裸石销售状态（幂等）
-- ------------------------------------------------------------
ALTER TABLE products     ADD COLUMN IF NOT EXISTS weight_unit      VARCHAR(20) DEFAULT '克(g)';
ALTER TABLE products     ADD COLUMN IF NOT EXISTS sale_price       DECIMAL(12,2) DEFAULT 0;
ALTER TABLE products     ADD COLUMN IF NOT EXISTS certificate_urls TEXT[] DEFAULT '{}';

ALTER TABLE loose_stones ADD COLUMN IF NOT EXISTS weight_unit      VARCHAR(20) DEFAULT '克(g)';
ALTER TABLE loose_stones ADD COLUMN IF NOT EXISTS certificate_urls TEXT[] DEFAULT '{}';
ALTER TABLE loose_stones ADD COLUMN IF NOT EXISTS sale_status      sale_status_enum DEFAULT 'in_stock';

-- 供应商（所有宝石分类通用）与黄金专用计价字段（幂等）
ALTER TABLE products ADD COLUMN IF NOT EXISTS supplier          VARCHAR(100);
ALTER TABLE products ADD COLUMN IF NOT EXISTS labor_sale_price  DECIMAL(12,2) DEFAULT 0; -- 工费销售价格 g/元
ALTER TABLE products ADD COLUMN IF NOT EXISTS labor_cost        DECIMAL(12,2) DEFAULT 0; -- 工费成本 g/元
ALTER TABLE products ADD COLUMN IF NOT EXISTS surcharge         DECIMAL(12,2) DEFAULT 0; -- 附加费，一笔总额
ALTER TABLE products ADD COLUMN IF NOT EXISTS purchase_discount DECIMAL(12,4) DEFAULT 1; -- 买入折扣

-- 销售记录支持裸石（product_id 已可空，新增 loose_stone_id）
ALTER TABLE product_sales ADD COLUMN IF NOT EXISTS loose_stone_id UUID REFERENCES loose_stones(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_product_sales_loose_stone ON product_sales(loose_stone_id);

-- 销售备注
ALTER TABLE product_sales ADD COLUMN IF NOT EXISTS notes TEXT;

-- ------------------------------------------------------------
-- 借调记录表（产品与裸石均可借调）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS item_loans (
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

CREATE INDEX IF NOT EXISTS idx_item_loans_product ON item_loans(product_id);
CREATE INDEX IF NOT EXISTS idx_item_loans_loose_stone ON item_loans(loose_stone_id);
CREATE INDEX IF NOT EXISTS idx_item_loans_returned ON item_loans(returned_at);

-- ------------------------------------------------------------
-- 回收记录表（关联产品用 UUID 数组，一条回收可关联多件产品）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recycles (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category     VARCHAR(20) NOT NULL,
  recycled_at  DATE NOT NULL DEFAULT CURRENT_DATE,
  product_ids  UUID[] DEFAULT '{}',
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recycles_recycled_at ON recycles(recycled_at DESC);

-- ------------------------------------------------------------
-- 加工单（一张单对应一件待加工的产品或裸石）
-- customer_name / code 为快照，客户或物品被删除后仍可追溯
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS processings (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code           VARCHAR(20),                                  -- 加工单号 J + 年月日时分秒
  ordered_at     DATE NOT NULL DEFAULT CURRENT_DATE,           -- 下单日期
  customer_id    UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name  VARCHAR(100) NOT NULL,
  product_id     UUID REFERENCES products(id) ON DELETE SET NULL,
  loose_stone_id UUID REFERENCES loose_stones(id) ON DELETE SET NULL,
  requirement    TEXT,                                         -- 加工要求
  fee            DECIMAL(12,2) NOT NULL DEFAULT 0,             -- 加工费用
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_processings_ordered_at ON processings(ordered_at DESC);
CREATE INDEX IF NOT EXISTS idx_processings_customer ON processings(customer_id);
CREATE INDEX IF NOT EXISTS idx_processings_product ON processings(product_id);
CREATE INDEX IF NOT EXISTS idx_processings_loose_stone ON processings(loose_stone_id);

-- ------------------------------------------------------------
-- 报价单（一个客户一张）与报价明细（一件产品一条）
-- 明细转为销售后回写 sale_id，不重复转
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quotes (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name VARCHAR(100) NOT NULL,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quotes_created_at ON quotes(created_at DESC);

CREATE TABLE IF NOT EXISTS quote_items (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quote_id     UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  product_id   UUID REFERENCES products(id) ON DELETE SET NULL,
  list_price   DECIMAL(12,2) NOT NULL DEFAULT 0, -- 产品原价
  discount     DECIMAL(6,4)  NOT NULL DEFAULT 1, -- 折扣乘数，0.85 = 85 折
  quoted_price DECIMAL(12,2) NOT NULL DEFAULT 0, -- 原价 × 折扣
  sale_id      UUID REFERENCES product_sales(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_quote_items_quote ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_product ON quote_items(product_id);

-- 黄金分类的报价按「工费小计 + 附加费小计 + 金价小计」展开，各项快照存在明细里（幂等）
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS is_gold            BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS weight             DECIMAL(12,3);  -- 克重
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS labor_price        DECIMAL(12,2);  -- 工费销售价格 g/元
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS labor_discount     DECIMAL(6,4);
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS labor_subtotal     DECIMAL(12,2);
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS surcharge          DECIMAL(12,2);  -- 附加费，一笔总额
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS surcharge_discount DECIMAL(6,4);
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS surcharge_subtotal DECIMAL(12,2);
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS gold_price         DECIMAL(12,2);  -- 当日金价 g/元
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS gold_subtotal      DECIMAL(12,2);
ALTER TABLE quote_items ADD COLUMN IF NOT EXISTS code               VARCHAR(20);    -- 报价编号 Q + 年月日时分秒

-- 销售记录回指报价明细，便于从销售流水反查报价
ALTER TABLE product_sales ADD COLUMN IF NOT EXISTS quote_item_id UUID REFERENCES quote_items(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_product_sales_quote_item ON product_sales(quote_item_id);

-- ------------------------------------------------------------
-- 自动更新 updated_at 触发器
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS loose_stones_updated_at ON loose_stones;
CREATE TRIGGER loose_stones_updated_at
  BEFORE UPDATE ON loose_stones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS quotes_updated_at ON quotes;
CREATE TRIGGER quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS processings_updated_at ON processings;
CREATE TRIGGER processings_updated_at
  BEFORE UPDATE ON processings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ------------------------------------------------------------
-- 自动生成编号触发器（前缀 + 北京时间年月日时分秒）
-- 产品以 P 开头，裸石以 L 开头
-- 用发号表保证唯一：同一秒内（含单条语句批量插入）自动顺延到下一秒
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS record_code_seq (
  prefix    VARCHAR(4) PRIMARY KEY,
  last_code VARCHAR(20) NOT NULL
);

-- 用已有数据的最大编号初始化，避免新编号与历史编号相撞
INSERT INTO record_code_seq (prefix, last_code)
SELECT 'P', max(code) FROM products WHERE code ~ '^P[0-9]{14}$'
HAVING max(code) IS NOT NULL
ON CONFLICT (prefix) DO NOTHING;

INSERT INTO record_code_seq (prefix, last_code)
SELECT 'L', max(code) FROM loose_stones WHERE code ~ '^L[0-9]{14}$'
HAVING max(code) IS NOT NULL
ON CONFLICT (prefix) DO NOTHING;

CREATE OR REPLACE FUNCTION next_record_code(p_prefix TEXT, p_at TIMESTAMPTZ)
RETURNS TEXT AS $$
DECLARE
  v_code TEXT;
BEGIN
  -- ON CONFLICT DO UPDATE 会锁住发号行，并发插入在此串行化
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

DROP TRIGGER IF EXISTS products_set_code ON products;
CREATE TRIGGER products_set_code
  BEFORE INSERT ON products
  FOR EACH ROW EXECUTE FUNCTION set_record_code('P');

DROP TRIGGER IF EXISTS loose_stones_set_code ON loose_stones;
CREATE TRIGGER loose_stones_set_code
  BEFORE INSERT ON loose_stones
  FOR EACH ROW EXECUTE FUNCTION set_record_code('L');

DROP TRIGGER IF EXISTS quote_items_set_code ON quote_items;
CREATE TRIGGER quote_items_set_code
  BEFORE INSERT ON quote_items
  FOR EACH ROW EXECUTE FUNCTION set_record_code('Q');

DROP TRIGGER IF EXISTS processings_set_code ON processings;
CREATE TRIGGER processings_set_code
  BEFORE INSERT ON processings
  FOR EACH ROW EXECUTE FUNCTION set_record_code('J');

-- 回填已有数据的编号（幂等）
UPDATE products     SET code = next_record_code('P', created_at) WHERE code IS NULL OR code = '';
UPDATE loose_stones SET code = next_record_code('L', created_at) WHERE code IS NULL OR code = '';
UPDATE quote_items  SET code = next_record_code('Q', created_at) WHERE code IS NULL OR code = '';
UPDATE processings  SET code = next_record_code('J', created_at) WHERE code IS NULL OR code = '';

-- ------------------------------------------------------------
-- 常用索引
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_products_sale_status ON products(sale_status);
CREATE INDEX IF NOT EXISTS idx_products_purchased_at ON products(purchased_at);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_name ON products USING gin(to_tsvector('simple', name));
CREATE INDEX IF NOT EXISTS idx_products_source_loose_stone ON products(source_loose_stone_id);

-- 编号唯一（旧的非唯一索引已被替换）
DROP INDEX IF EXISTS idx_products_code;
DROP INDEX IF EXISTS idx_loose_stones_code;
CREATE UNIQUE INDEX IF NOT EXISTS uq_products_code ON products(code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_loose_stones_code ON loose_stones(code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_quote_items_code ON quote_items(code);
CREATE UNIQUE INDEX IF NOT EXISTS uq_processings_code ON processings(code);

-- ============================================================
-- 行级安全策略 (RLS)
-- ============================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE loose_stones ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_loans ENABLE ROW LEVEL SECURITY;
ALTER TABLE recycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE processings ENABLE ROW LEVEL SECURITY;
ALTER TABLE record_code_seq ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read products" ON products;
CREATE POLICY "Authenticated users can read products"
  ON products FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can write products" ON products;
CREATE POLICY "Authenticated users can write products"
  ON products FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage customers" ON customers;
CREATE POLICY "Authenticated users can manage customers"
  ON customers FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage sales" ON product_sales;
CREATE POLICY "Authenticated users can manage sales"
  ON product_sales FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage loose stones" ON loose_stones;
CREATE POLICY "Authenticated users can manage loose stones"
  ON loose_stones FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage returns" ON product_returns;
CREATE POLICY "Authenticated users can manage returns"
  ON product_returns FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage loans" ON item_loans;
CREATE POLICY "Authenticated users can manage loans"
  ON item_loans FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage recycles" ON recycles;
CREATE POLICY "Authenticated users can manage recycles"
  ON recycles FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage quotes" ON quotes;
CREATE POLICY "Authenticated users can manage quotes"
  ON quotes FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage quote items" ON quote_items;
CREATE POLICY "Authenticated users can manage quote items"
  ON quote_items FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users can manage processings" ON processings;
CREATE POLICY "Authenticated users can manage processings"
  ON processings FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 文件存储
-- 已改用阿里云 OSS，由应用服务端 SDK 直接上传，不再使用 Supabase Storage。
-- ============================================================

-- ============================================================
-- 应用账号表（自建用户名登录，密码 bcrypt 哈希）
-- 仅供服务端 service_role 访问，RLS 默认拒绝 anon/authenticated
-- ============================================================
CREATE TABLE IF NOT EXISTS app_users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username      VARCHAR(100) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role          VARCHAR(20) NOT NULL DEFAULT 'user', -- super_admin / user
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  -- 可访问的菜单 key 列表（值见 lib/menus.ts）；NULL = 默认全部业务菜单
  menu_perms    TEXT[],
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 已有库补列（本文件仅在空库时自动执行一次，存量环境需手动跑）
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS menu_perms TEXT[];

ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
-- 不创建任何 policy：anon/authenticated 一律拒绝，只有 service_role 可读写。

-- 不在此处插入初始账号：建表脚本在仓库里是公开的，写死的 bcrypt 哈希等同于公开密码。
-- 初始超管由应用首次登录时根据 SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD 创建。
