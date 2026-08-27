"use client";

import { Product, QuoteItem } from "@/types";
import { computeQuotePricing } from "@/lib/quotes";
import { formatCurrency } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface QuoteItemFormState {
  listPrice: string;
  discount: string;
  weight: string;
  laborPrice: string;
  laborDiscount: string;
  surcharge: string;
  surchargeDiscount: string;
  goldPrice: string;
}

export const emptyQuoteItemForm: QuoteItemFormState = {
  listPrice: "",
  discount: "1",
  weight: "",
  laborPrice: "",
  laborDiscount: "1",
  surcharge: "",
  surchargeDiscount: "1",
  goldPrice: "",
};

const text = (v: number | null | undefined) => (v == null ? "" : String(v));

export function quoteItemFormFromProduct(p: Product): QuoteItemFormState {
  return {
    listPrice: text(p.price),
    discount: "1",
    weight: text(p.total_weight),
    laborPrice: text(p.labor_sale_price),
    laborDiscount: "1",
    surcharge: text(p.surcharge),
    surchargeDiscount: "1",
    goldPrice: "",
  };
}

export function quoteItemFormFromItem(item: QuoteItem): QuoteItemFormState {
  return {
    listPrice: text(item.list_price),
    discount: text(item.discount) || "1",
    weight: text(item.weight),
    laborPrice: text(item.labor_price),
    laborDiscount: text(item.labor_discount) || "1",
    surcharge: text(item.surcharge),
    surchargeDiscount: text(item.surcharge_discount) || "1",
    goldPrice: text(item.gold_price),
  };
}

export function quoteItemPayload(state: QuoteItemFormState, isGold: boolean) {
  return {
    is_gold: isGold,
    weight: Number(state.weight || 0),
    list_price: Number(state.listPrice || 0),
    discount: Number(state.discount || 0),
    labor_price: Number(state.laborPrice || 0),
    labor_discount: Number(state.laborDiscount || 0),
    surcharge: Number(state.surcharge || 0),
    surcharge_discount: Number(state.surchargeDiscount || 0),
    gold_price: Number(state.goldPrice || 0),
  };
}

export function quoteItemPricing(state: QuoteItemFormState, isGold: boolean) {
  return computeQuotePricing(quoteItemPayload(state, isGold));
}

function Readonly({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex h-10 items-center rounded-md border border-input bg-gray-50 px-3 text-sm text-gray-800">
        {formatCurrency(value)}
      </div>
    </div>
  );
}

/** 报价计价输入区：黄金按工费/附加费/金价三段展开，其他分类只有金额与折扣 */
export function QuoteItemFields({
  state,
  onChange,
  isGold,
  idPrefix,
}: {
  state: QuoteItemFormState;
  onChange: (next: QuoteItemFormState) => void;
  isGold: boolean;
  idPrefix: string;
}) {
  const pricing = quoteItemPricing(state, isGold);
  const set = (key: keyof QuoteItemFormState) => (value: string) =>
    onChange({ ...state, [key]: value });

  if (!isGold) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-list-price`}>产品金额</Label>
          <Input
            id={`${idPrefix}-list-price`}
            type="number"
            inputMode="decimal"
            value={state.listPrice}
            onChange={(e) => set("listPrice")(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-discount`}>折扣</Label>
          <Input
            id={`${idPrefix}-discount`}
            type="number"
            inputMode="decimal"
            step="0.01"
            value={state.discount}
            onChange={(e) => set("discount")(e.target.value)}
            placeholder="0.85 = 85 折"
          />
        </div>
        <Readonly label="报价金额" value={pricing.quoted_price} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-labor-price`}>工费销售价格 (g/元)</Label>
          <Input
            id={`${idPrefix}-labor-price`}
            type="number"
            inputMode="decimal"
            value={state.laborPrice}
            onChange={(e) => set("laborPrice")(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-labor-discount`}>工费销售折扣</Label>
          <Input
            id={`${idPrefix}-labor-discount`}
            type="number"
            inputMode="decimal"
            step="0.01"
            value={state.laborDiscount}
            onChange={(e) => set("laborDiscount")(e.target.value)}
          />
        </div>
        <Readonly label="工费小计" value={pricing.labor_subtotal} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-surcharge`}>附加费 (元)</Label>
          <Input
            id={`${idPrefix}-surcharge`}
            type="number"
            inputMode="decimal"
            value={state.surcharge}
            onChange={(e) => set("surcharge")(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-surcharge-discount`}>附加费折扣</Label>
          <Input
            id={`${idPrefix}-surcharge-discount`}
            type="number"
            inputMode="decimal"
            step="0.01"
            value={state.surchargeDiscount}
            onChange={(e) => set("surchargeDiscount")(e.target.value)}
          />
        </div>
        <Readonly label="附加费小计" value={pricing.surcharge_subtotal} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-gold-price`}>当日金价 (g/元) *</Label>
          <Input
            id={`${idPrefix}-gold-price`}
            type="number"
            inputMode="decimal"
            value={state.goldPrice}
            onChange={(e) => set("goldPrice")(e.target.value)}
            placeholder="按克计价"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-weight`}>克重</Label>
          <Input
            id={`${idPrefix}-weight`}
            type="number"
            inputMode="decimal"
            value={state.weight}
            onChange={(e) => set("weight")(e.target.value)}
          />
        </div>
        <Readonly label="金价小计" value={pricing.gold_subtotal} />
      </div>

      <p className="text-xs text-gray-400">
        工费小计 = 工费销售价格 × 克重 × 工费销售折扣；附加费小计 = 附加费 ×
        附加费折扣；金价小计 = 当日金价 × 克重
      </p>
    </div>
  );
}
