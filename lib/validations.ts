import { z } from "zod";

export const saleStatusEnum = z.enum(["in_stock", "sold", "consignment"]);

export const productSchema = z.object({
  image_urls: z.array(z.string().url()).default([]),
  certificate_urls: z.array(z.string().url()).default([]),
  name: z.string().min(1, "产品名称必填").max(255),
  total_weight: z.coerce.number().nonnegative().nullable().optional(),
  weight_unit: z.string().max(20).nullable().optional(),
  size: z.string().max(100).nullable().optional(),
  origin: z.string().max(100).nullable().optional(),
  inlaid_stones: z.string().nullable().optional(),
  gemstone_category: z.string().max(100).nullable().optional(),
  function_category: z.string().max(100).nullable().optional(),
  supplier: z.string().max(100).nullable().optional(),
  labor_sale_price: z.coerce.number().nonnegative().nullable().optional(),
  labor_cost: z.coerce.number().nonnegative().nullable().optional(),
  surcharge: z.coerce.number().nonnegative().nullable().optional(),
  purchase_discount: z.coerce.number().nonnegative().nullable().optional(),
  source_loose_stone_id: z.string().uuid().nullable().optional(),
  price: z.coerce.number().nonnegative("价格必须为非负数"),
  purchase_price: z.coerce.number().nonnegative().default(0),
  sale_price: z.coerce.number().nonnegative().default(0),
  sale_status: saleStatusEnum.default("in_stock"),
  settled_amount: z.coerce.number().nonnegative().default(0),
  is_consignment: z.boolean().default(false),
  is_loose_stone: z.boolean().default(false),
  purchased_at: z.string().nullable().optional(),
  sold_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type ProductSchema = z.infer<typeof productSchema>;

export const looseStoneSchema = z.object({
  image_urls: z.array(z.string().url()).default([]),
  certificate_urls: z.array(z.string().url()).default([]),
  size: z.string().max(100).nullable().optional(),
  material: z.string().max(100).nullable().optional(),
  weight: z.coerce.number().nonnegative().nullable().optional(),
  weight_unit: z.string().max(20).nullable().optional(),
  price: z.coerce.number().nonnegative().default(0),
  gemstone_category: z.string().max(100).nullable().optional(),
  origin: z.string().max(100).nullable().optional(),
  certificate: z.string().max(255).nullable().optional(),
  purchase_price: z.coerce.number().nonnegative().default(0),
  sale_price: z.coerce.number().nonnegative().optional(),
  sale_status: saleStatusEnum.optional(),
  purchased_at: z.string().nullable().optional(),
  sold_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type LooseStoneSchema = z.infer<typeof looseStoneSchema>;

export const customerSchema = z.object({
  name: z.string().min(1, "客户姓名必填").max(100),
  phone: z.string().max(20).nullable().optional(),
  wechat: z.string().max(100).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type CustomerSchema = z.infer<typeof customerSchema>;

export const saleSchema = z
  .object({
    product_id: z.string().uuid().nullable().optional(),
    loose_stone_id: z.string().uuid().nullable().optional(),
    customer_id: z.string().uuid().nullable().optional(),
    sale_price: z.coerce.number().nonnegative(),
    payment_method: z.string().max(50).nullable().optional(),
    sold_at: z.string().optional(),
    notes: z.string().max(2000).nullable().optional(),
    sale_status: z.enum(["sold", "consignment"]).default("sold"),
  })
  .refine((d) => d.product_id || d.loose_stone_id, {
    message: "需选择产品或裸石",
  });

export type SaleSchema = z.infer<typeof saleSchema>;

export const loanBaseSchema = z.object({
  product_id: z.string().uuid().nullable().optional(),
  loose_stone_id: z.string().uuid().nullable().optional(),
  borrower_name: z.string().min(1, "借出人必填").max(100),
  borrower_contact: z.string().max(100).nullable().optional(),
  loaned_at: z.string().optional(),
  due_at: z.string().nullable().optional(),
  returned_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const loanSchema = loanBaseSchema.refine(
  (d) => d.product_id || d.loose_stone_id,
  { message: "需选择产品或裸石" }
);

export type LoanSchema = z.infer<typeof loanSchema>;

export const returnSchema = z.object({
  sale_id: z.string().uuid().nullable().optional(),
  product_id: z.string().uuid().nullable().optional(),
  customer_id: z.string().uuid().nullable().optional(),
  refund_amount: z.coerce.number().nonnegative(),
  reason: z.string().nullable().optional(),
  returned_at: z.string().optional(),
});

export type ReturnSchema = z.infer<typeof returnSchema>;

export const recycleSchema = z.object({
  category: z.enum(["黄金", "宝石"]),
  recycled_at: z.string().min(1, "日期必填"),
  product_ids: z.array(z.string().uuid()).default([]),
  notes: z.string().max(2000).nullable().optional(),
});

export type RecycleSchema = z.infer<typeof recycleSchema>;

export const processingBaseSchema = z.object({
  ordered_at: z.string().min(1, "下单日期必填"),
  customer_id: z.string().uuid().nullable().optional(),
  customer_name: z.string().min(1, "客户名字必填").max(100),
  product_id: z.string().uuid().nullable().optional(),
  loose_stone_id: z.string().uuid().nullable().optional(),
  requirement: z.string().max(2000).nullable().optional(),
  fee: z.coerce.number().nonnegative().default(0),
});

export const processingSchema = processingBaseSchema.refine(
  (d) => d.product_id || d.loose_stone_id,
  { message: "需选择要加工的产品或裸石" }
);

export type ProcessingSchema = z.infer<typeof processingSchema>;

export const quoteSchema = z.object({
  customer_id: z.string().uuid().nullable().optional(),
  customer_name: z.string().min(1, "客户名称必填").max(100),
  notes: z.string().max(2000).nullable().optional(),
});

export type QuoteSchema = z.infer<typeof quoteSchema>;

export const quoteItemSchema = z.object({
  quote_id: z.string().uuid(),
  product_id: z.string().uuid(),
  is_gold: z.boolean().default(false),
  weight: z.coerce.number().nonnegative().nullable().optional(),
  list_price: z.coerce.number().nonnegative().default(0),
  discount: z.coerce.number().nonnegative().max(10).default(1),
  labor_price: z.coerce.number().nonnegative().nullable().optional(),
  labor_discount: z.coerce.number().nonnegative().max(10).nullable().optional(),
  surcharge: z.coerce.number().nonnegative().nullable().optional(),
  surcharge_discount: z.coerce
    .number()
    .nonnegative()
    .max(10)
    .nullable()
    .optional(),
  gold_price: z.coerce.number().nonnegative().nullable().optional(),
});

export type QuoteItemSchema = z.infer<typeof quoteItemSchema>;

export const quoteItemUpdateSchema = quoteItemSchema
  .omit({ quote_id: true, product_id: true })
  .partial();
