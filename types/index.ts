export type SaleStatus = "in_stock" | "sold" | "consignment";

// 宝石分类 / 功能分类已改为自由文本
export type GemstoneCategory = string;

export type ProductFunction = string;

export interface Product {
  id: string;
  code: string | null;
  image_urls: string[];
  certificate_urls: string[];
  name: string;
  total_weight: number | null;
  weight_unit: string | null;
  size: string | null;
  origin: string | null;
  inlaid_stones: string | null;
  gemstone_category: GemstoneCategory | null;
  function_category: ProductFunction | null;
  supplier: string | null;
  /** 工费销售价格 g/元（黄金专用） */
  labor_sale_price: number | null;
  /** 工费成本 g/元（黄金专用） */
  labor_cost: number | null;
  /** 附加费，一笔总额（黄金专用） */
  surcharge: number | null;
  /** 买入折扣（黄金专用） */
  purchase_discount: number | null;
  source_loose_stone_id: string | null;
  price: number;
  purchase_price: number;
  sale_price: number;
  sale_status: SaleStatus;
  settled_amount: number;
  unsettled_amount: number; // 数据库自动计算
  is_consignment: boolean;
  is_loose_stone: boolean;
  profit: number; // 数据库自动计算
  purchased_at: string | null;
  sold_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** 派生字段：是否存在未归还的借调记录 */
  is_loaned?: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  wechat: string | null;
  notes: string | null;
  created_at: string;
}

export interface LooseStone {
  id: string;
  code: string | null;
  image_urls: string[];
  certificate_urls: string[];
  size: string | null;
  material: string | null;
  weight: number | null;
  weight_unit: string | null;
  price: number;
  gemstone_category: GemstoneCategory | null;
  origin: string | null;
  certificate: string | null;
  purchase_price: number;
  sale_price: number;
  sale_status: SaleStatus;
  purchased_at: string | null;
  sold_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  /** 派生字段：是否已被产品使用 */
  is_used?: boolean;
  /** 派生字段：是否存在未归还的借调记录 */
  is_loaned?: boolean;
}

export type LooseStoneInput = {
  image_urls: string[];
  certificate_urls: string[];
  size: string | null;
  material: string | null;
  weight: number | null;
  weight_unit: string | null;
  price: number;
  gemstone_category: GemstoneCategory | null;
  origin: string | null;
  certificate: string | null;
  purchase_price: number;
  purchased_at: string | null;
  notes: string | null;
};

export interface ProductSale {
  id: string;
  product_id: string | null;
  loose_stone_id: string | null;
  customer_id: string | null;
  quote_item_id: string | null;
  sale_price: number;
  payment_method: string | null;
  /** 销售员，手动录入 */
  salesperson: string | null;
  sold_at: string;
  notes: string | null;
  created_at: string;
}

export interface ProductSaleWithRelations extends ProductSale {
  products?: Pick<
    Product,
    "id" | "code" | "name" | "image_urls" | "sale_status"
  > | null;
  loose_stones?: Pick<
    LooseStone,
    "id" | "code" | "material" | "image_urls" | "sale_status"
  > | null;
  customers?: Pick<Customer, "id" | "name"> | null;
  quote_items?: { id: string; code: string | null; quote_id: string } | null;
}

export interface ItemLoan {
  id: string;
  product_id: string | null;
  loose_stone_id: string | null;
  borrower_name: string;
  borrower_contact: string | null;
  loaned_at: string;
  due_at: string | null;
  returned_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface ItemLoanWithRelations extends ItemLoan {
  products?: Pick<Product, "id" | "name" | "image_urls"> | null;
  loose_stones?: Pick<LooseStone, "id" | "material" | "image_urls"> | null;
}

export type ItemLoanInput = {
  product_id: string | null;
  loose_stone_id: string | null;
  borrower_name: string;
  borrower_contact: string | null;
  loaned_at: string;
  due_at: string | null;
  returned_at: string | null;
  notes: string | null;
};

export const RECYCLE_CATEGORIES = ["黄金", "宝石"] as const;
export type RecycleCategory = (typeof RECYCLE_CATEGORIES)[number];

export interface Recycle {
  id: string;
  category: RecycleCategory;
  recycled_at: string;
  product_ids: string[];
  notes: string | null;
  created_at: string;
}

export interface ProductReturn {  id: string;
  sale_id: string | null;
  product_id: string | null;
  customer_id: string | null;
  refund_amount: number;
  reason: string | null;
  returned_at: string;
  created_at: string;
}

export interface ProductReturnWithRelations extends ProductReturn {
  products?: Pick<Product, "id" | "name" | "image_urls"> | null;
  customers?: Pick<Customer, "id" | "name"> | null;
}

export interface Quote {
  id: string;
  customer_id: string | null;
  customer_name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteItem {
  id: string;
  code: string | null;
  quote_id: string;
  product_id: string | null;
  list_price: number;
  /** 折扣乘数，0.85 = 85 折 */
  discount: number;
  quoted_price: number;
  is_gold: boolean;
  weight: number | null;
  labor_price: number | null;
  labor_discount: number | null;
  labor_subtotal: number | null;
  surcharge: number | null;
  surcharge_discount: number | null;
  surcharge_subtotal: number | null;
  gold_price: number | null;
  gold_subtotal: number | null;
  sale_id: string | null;
  created_at: string;
}

export interface QuoteItemWithProduct extends QuoteItem {
  products?: Pick<
    Product,
    | "id"
    | "code"
    | "name"
    | "price"
    | "sale_status"
    | "image_urls"
    | "total_weight"
    | "weight_unit"
    | "size"
    | "inlaid_stones"
    | "gemstone_category"
    | "function_category"
  > | null;
}

export interface QuoteWithItems extends Quote {
  quote_items?: QuoteItemWithProduct[];
}

export interface Processing {
  id: string;
  /** 加工单号 J + 年月日时分秒，由数据库触发器生成 */
  code: string | null;
  ordered_at: string;
  customer_id: string | null;
  customer_name: string;
  product_id: string | null;
  loose_stone_id: string | null;
  requirement: string | null;
  fee: number;
  created_at: string;
  updated_at: string;
}

export interface ProcessingWithRelations extends Processing {
  products?: Pick<
    Product,
    | "id"
    | "code"
    | "name"
    | "image_urls"
    | "total_weight"
    | "weight_unit"
    | "size"
    | "inlaid_stones"
    | "gemstone_category"
    | "function_category"
  > | null;
  loose_stones?: Pick<
    LooseStone,
    | "id"
    | "code"
    | "material"
    | "image_urls"
    | "weight"
    | "weight_unit"
    | "size"
    | "gemstone_category"
  > | null;
  customers?: Pick<Customer, "id" | "name"> | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/** 产品表单输入类型（不含自动计算字段与时间戳） */
export type ProductInput = {
  image_urls: string[];
  certificate_urls: string[];
  name: string;
  total_weight: number | null;
  weight_unit: string | null;
  size: string | null;
  origin: string | null;
  inlaid_stones: string | null;
  gemstone_category: GemstoneCategory | null;
  function_category: ProductFunction | null;
  supplier: string | null;
  labor_sale_price: number | null;
  labor_cost: number | null;
  surcharge: number | null;
  purchase_discount: number | null;
  source_loose_stone_id: string | null;
  price: number;
  purchase_price: number;
  sale_price: number;
  sale_status: SaleStatus;
  settled_amount: number;
  is_consignment: boolean;
  is_loose_stone: boolean;
  purchased_at: string | null;
  sold_at: string | null;
  notes: string | null;
};
