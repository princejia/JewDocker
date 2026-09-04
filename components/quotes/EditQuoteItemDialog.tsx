"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QuoteItemWithProduct } from "@/types";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  QuoteItemFields,
  emptyQuoteItemForm,
  quoteItemFormFromItem,
  quoteItemPayload,
  quoteItemPricing,
  type QuoteItemFormState,
} from "@/components/quotes/QuoteItemFields";

const num = (v: number | null | undefined) => String(Number(v ?? 0));

/** 已转销售的报价不可修改，只展示当时写入的计价快照 */
function detailRows(item: QuoteItemWithProduct): [string, string][] {
  if (!item.is_gold) {
    return [
      ["产品金额", formatCurrency(item.list_price)],
      ["折扣", num(item.discount)],
    ];
  }
  return [
    ["工费销售价格 (g/元)", formatCurrency(item.labor_price ?? 0)],
    ["工费销售折扣", num(item.labor_discount ?? 1)],
    ["工费小计", formatCurrency(item.labor_subtotal ?? 0)],
    ["附加费 (元)", formatCurrency(item.surcharge ?? 0)],
    ["附加费折扣", num(item.surcharge_discount ?? 1)],
    ["附加费小计", formatCurrency(item.surcharge_subtotal ?? 0)],
    ["当日金价 (g/元)", formatCurrency(item.gold_price ?? 0)],
    ["克重", item.weight != null ? `${Number(item.weight)} g` : "-"],
    ["金价小计", formatCurrency(item.gold_subtotal ?? 0)],
  ];
}

export function EditQuoteItemDialog({
  item,
  readOnly = false,
  onOpenChange,
}: {
  item: QuoteItemWithProduct | null;
  readOnly?: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<QuoteItemFormState>(emptyQuoteItemForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setState(quoteItemFormFromItem(item));
      setError(null);
    }
  }, [item]);

  if (!item) return null;

  const isGold = item.is_gold;
  const pricing = quoteItemPricing(state, isGold);

  if (readOnly) {
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              报价详情
              {item.code && (
                <span className="ml-2 font-mono text-xs text-gray-400">
                  {item.code}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {item.products?.code && (
                <span className="font-mono text-xs text-gray-500">
                  {item.products.code}
                </span>
              )}
              <span className="font-medium text-gray-800">
                {item.products?.name ?? "已删除产品"}
              </span>
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700">
                已转销售
              </span>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                {isGold ? "黄金计价" : "按金额折扣"}
              </span>
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg bg-gray-50 p-4 text-sm sm:grid-cols-2">
              {detailRows(item).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-3">
                  <dt className="text-gray-500">{label}</dt>
                  <dd className="font-medium text-gray-800">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <p className="text-xs text-gray-400">
                报价于 {formatDateTime(item.created_at)}
              </p>
              <p className="text-sm text-gray-500">
                销售价格{" "}
                <span className="ml-1 text-xl font-bold text-amber-700">
                  {formatCurrency(item.quoted_price)}
                </span>
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  async function handleSave() {
    if (!item) return;
    setError(null);
    if (isGold && !Number(state.goldPrice || 0)) {
      setError("请输入当日金价");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/quote-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quoteItemPayload(state, isGold)),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "保存失败");
      return;
    }
    onOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            修改报价
            {item.code && (
              <span className="ml-2 font-mono text-xs text-gray-400">
                {item.code}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            {item.products?.name ?? "已删除产品"}
          </p>
          <QuoteItemFields
            state={state}
            onChange={setState}
            isGold={isGold}
            idPrefix="edit"
          />
          <p className="text-sm text-gray-500">
            销售价格{" "}
            <span className="ml-1 text-xl font-bold text-amber-700">
              {formatCurrency(pricing.quoted_price)}
            </span>
          </p>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
