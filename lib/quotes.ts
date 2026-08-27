export interface QuotePricingInput {
  is_gold?: boolean | null;
  /** 克重 */
  weight?: number | null;
  /** 非黄金：产品金额 */
  list_price?: number | null;
  /** 非黄金：折扣乘数 */
  discount?: number | null;
  /** 黄金：工费销售价格 g/元 */
  labor_price?: number | null;
  labor_discount?: number | null;
  /** 黄金：附加费，一笔总额 */
  surcharge?: number | null;
  surcharge_discount?: number | null;
  /** 黄金：当日金价 g/元 */
  gold_price?: number | null;
}

export interface QuotePricing {
  labor_subtotal: number;
  surcharge_subtotal: number;
  gold_subtotal: number;
  quoted_price: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const num = (v: unknown) => Number(v || 0);

/**
 * 报价算价。黄金：工费小计(工费价×克重×折扣) + 附加费小计(附加费×折扣) + 金价小计(当日金价×克重)；
 * 其他分类：产品金额 × 折扣。
 */
export function computeQuotePricing(input: QuotePricingInput): QuotePricing {
  if (!input.is_gold) {
    return {
      labor_subtotal: 0,
      surcharge_subtotal: 0,
      gold_subtotal: 0,
      quoted_price: round2(num(input.list_price) * num(input.discount)),
    };
  }

  const weight = num(input.weight);
  const labor = round2(num(input.labor_price) * weight * num(input.labor_discount));
  const surcharge = round2(num(input.surcharge) * num(input.surcharge_discount));
  const gold = round2(num(input.gold_price) * weight);

  return {
    labor_subtotal: labor,
    surcharge_subtotal: surcharge,
    gold_subtotal: gold,
    quoted_price: round2(labor + surcharge + gold),
  };
}
