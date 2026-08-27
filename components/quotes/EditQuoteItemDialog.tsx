"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QuoteItemWithProduct } from "@/types";
import { formatCurrency } from "@/lib/utils";
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

export function EditQuoteItemDialog({
  item,
  onOpenChange,
}: {
  item: QuoteItemWithProduct | null;
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
