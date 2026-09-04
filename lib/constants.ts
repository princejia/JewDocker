import { GemstoneCategory, Product, ProductFunction } from "@/types";

/** 宝石分类默认建议项（自由文本输入，可被历史数据补充） */
export const GEMSTONE_CATEGORY_SUGGESTIONS: string[] = ["翡翠", "蓝宝", "黄金"];

/** 是否为黄金分类（黄金有专属的工费 / 附加费计价字段） */
export function isGoldCategory(value?: string | null): boolean {
  return categoryLabel(value) === "黄金";
}

/**
 * 进货成本：黄金按「进货总成本」展开计算，其他分类直接用进货价。
 * 黄金 = 进货价(g/元)×重量 + 工费成本(g/元)×重量 + 附加费×买入折扣
 */
export function purchaseCostOf(
  p: Pick<
    Product,
    | "gemstone_category"
    | "total_weight"
    | "purchase_price"
    | "labor_cost"
    | "surcharge"
    | "purchase_discount"
  >
): number {
  const purchasePrice = Number(p.purchase_price || 0);
  if (!isGoldCategory(p.gemstone_category)) return purchasePrice;

  const weight = Number(p.total_weight || 0);
  return (
    weight * purchasePrice +
    weight * Number(p.labor_cost || 0) +
    Number(p.surcharge || 0) * Number(p.purchase_discount || 0)
  );
}

export interface GoldProfitParts {
  laborProfit: number;
  surchargeProfit: number;
  goldProfit: number;
}

/**
 * 黄金成交的三段利润拆解，三项之和恒等于「出售价 − 进货成本」。
 * 销售侧工费/附加费优先取报价快照（已含折扣），无报价时按产品档案估算；
 * 金价部分取成交价扣掉前两项的余额，保证与实际成交价对齐。
 */
export function goldProfitParts(
  p: Pick<
    Product,
    | "gemstone_category"
    | "total_weight"
    | "purchase_price"
    | "labor_cost"
    | "labor_sale_price"
    | "surcharge"
    | "purchase_discount"
  >,
  salePrice: number,
  quoted?: {
    labor_subtotal: number | null;
    surcharge_subtotal: number | null;
  } | null
): GoldProfitParts | null {
  if (!isGoldCategory(p.gemstone_category)) return null;

  const weight = Number(p.total_weight || 0);
  const laborSale =
    quoted?.labor_subtotal != null
      ? Number(quoted.labor_subtotal)
      : Number(p.labor_sale_price || 0) * weight;
  const surchargeSale =
    quoted?.surcharge_subtotal != null
      ? Number(quoted.surcharge_subtotal)
      : Number(p.surcharge || 0);
  const goldSale = salePrice - laborSale - surchargeSale;

  return {
    laborProfit: laborSale - Number(p.labor_cost || 0) * weight,
    surchargeProfit:
      surchargeSale -
      Number(p.surcharge || 0) * Number(p.purchase_discount || 0),
    goldProfit: goldSale - Number(p.purchase_price || 0) * weight,
  };
}

/** 功能分类默认建议项（自由文本输入，可被历史数据补充） */
export const PRODUCT_FUNCTION_SUGGESTIONS: string[] = ["吊坠", "项链", "手镯"];

// 兼容历史枚举值的展示映射
const LEGACY_CATEGORY_LABELS: Record<string, string> = {
  jade: "翡翠",
  sapphire: "蓝宝",
  pendant: "吊坠",
  necklace: "项链",
  bracelet: "手镯",
  gold: "黄金",
};

/** 展示分类值：旧枚举值映射为中文，其余直接展示原始文本 */
export function categoryLabel(
  value?: GemstoneCategory | ProductFunction | null
): string {
  if (!value) return "";
  return LEGACY_CATEGORY_LABELS[value] ?? value;
}
