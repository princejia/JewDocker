"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import {
  Customer,
  LooseStone,
  Processing,
  Product,
  ProcessingWithRelations,
} from "@/types";
import { cn, formatProductCode } from "@/lib/utils";
import {
  ProductHoverPreview,
  HoverPreview,
  PreviewProduct,
} from "@/components/products/ProductHoverPreview";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ItemOption {
  key: string;
  type: "product" | "loose_stone";
  id: string;
  code: string;
  name: string;
  preview: PreviewProduct;
}

interface Props {
  processing?: ProcessingWithRelations | Processing;
  trigger?: React.ReactNode;
  onSaved: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

/** 可搜索的单选下拉：聚焦后展开候选列表，输入即时过滤 */
function SearchSelect({
  id,
  value,
  displayValue,
  placeholder,
  emptyText,
  options,
  onSelect,
  onClear,
  renderOption,
  onOptionEnter,
  onOptionLeave,
}: {
  id: string;
  value: string;
  displayValue: string;
  placeholder: string;
  emptyText: string;
  options: { id: string; keywords: string }[];
  onSelect: (id: string) => void;
  onClear: () => void;
  renderOption: (id: string) => React.ReactNode;
  onOptionEnter?: (id: string, e: React.MouseEvent) => void;
  onOptionLeave?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? options.filter((o) => o.keywords.toLowerCase().includes(q))
    : options;

  return (
    <div>
      <div className="relative">
        <Input
          id={id}
          value={open ? query : displayValue}
          placeholder={placeholder}
          autoComplete="off"
          onFocus={() => {
            setQuery("");
            setOpen(true);
          }}
          onBlur={() => setOpen(false)}
          onChange={(e) => setQuery(e.target.value)}
        />
        {value && !open && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="清除选择"
            onClick={onClear}
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      {open && (
        <div className="mt-1 max-h-48 overflow-y-auto rounded-md border">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-gray-400">
              {options.length === 0 ? emptyText : "无匹配项"}
            </p>
          ) : (
            filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                // 阻止默认行为可避免输入框先失焦导致列表在 click 前被卸载
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onSelect(o.id);
                  setOpen(false);
                  onOptionLeave?.();
                }}
                onMouseEnter={(e) => onOptionEnter?.(o.id, e)}
                onMouseLeave={() => onOptionLeave?.()}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-amber-50",
                  o.id === value && "bg-amber-100"
                )}
              >
                {renderOption(o.id)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function ProcessingFormDialog({ processing, trigger, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stones, setStones] = useState<LooseStone[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<HoverPreview | null>(null);

  const [orderedAt, setOrderedAt] = useState(today());
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [itemKey, setItemKey] = useState("");
  const [requirement, setRequirement] = useState("");
  const [fee, setFee] = useState("");

  useEffect(() => {
    if (!open) return;
    setOrderedAt(processing?.ordered_at ?? today());
    setCustomerId(processing?.customer_id ?? "");
    setCustomerName(processing?.customer_name ?? "");
    setItemKey(
      processing?.product_id
        ? `product:${processing.product_id}`
        : processing?.loose_stone_id
        ? `loose_stone:${processing.loose_stone_id}`
        : ""
    );
    setRequirement(processing?.requirement ?? "");
    setFee(processing?.fee != null ? String(processing.fee) : "");
    setError(null);
  }, [open, processing]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/customers", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setCustomers(j.data ?? []))
      .catch(() => undefined);

    fetch("/api/loose-stones", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setStones(j.data ?? []))
      .catch(() => undefined);

    // 产品接口单页上限 100，逐页拉全，保证搜索能覆盖所有产品
    (async () => {
      const all: Product[] = [];
      let current = 1;
      let pages = 1;
      do {
        const res = await fetch(`/api/products?limit=100&page=${current}`, {
          cache: "no-store",
        });
        if (!res.ok) break;
        const json = await res.json();
        all.push(...(json.data ?? []));
        pages = json.totalPages ?? 1;
        current += 1;
      } while (current <= pages);
      setProducts(all);
    })();
  }, [open]);

  const itemOptions = useMemo<ItemOption[]>(() => {
    const fromProducts = products.map<ItemOption>((p) => ({
      key: `product:${p.id}`,
      type: "product",
      id: p.id,
      code: p.code ?? formatProductCode("P", p.created_at),
      name: p.name,
      preview: {
        name: p.name,
        image_urls: p.image_urls,
        total_weight: p.total_weight,
        weight_unit: p.weight_unit,
        size: p.size,
        inlaid_stones: p.inlaid_stones,
        gemstone_category: p.gemstone_category,
        function_category: p.function_category,
      },
    }));
    const fromStones = stones.map<ItemOption>((s) => ({
      key: `loose_stone:${s.id}`,
      type: "loose_stone",
      id: s.id,
      code: s.code ?? formatProductCode("L", s.created_at),
      name: s.material || "裸石",
      preview: {
        name: s.material || "裸石",
        image_urls: s.image_urls,
        total_weight: s.weight,
        weight_unit: s.weight_unit,
        size: s.size,
        inlaid_stones: null,
        gemstone_category: s.gemstone_category,
        function_category: null,
      },
    }));
    return [...fromProducts, ...fromStones];
  }, [products, stones]);

  const selectedItem = itemOptions.find((o) => o.key === itemKey);
  const selectedCustomer = customers.find((c) => c.id === customerId);

  async function handleSubmit() {
    setError(null);
    const name = (selectedCustomer?.name ?? customerName).trim();
    if (!name) {
      setError("请选择客户");
      return;
    }
    if (!selectedItem) {
      setError("请选择要加工的产品资料");
      return;
    }
    setSaving(true);
    const res = await fetch(
      processing ? `/api/processings/${processing.id}` : "/api/processings",
      {
        method: processing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ordered_at: orderedAt,
          customer_id: customerId || null,
          customer_name: name,
          product_id: selectedItem.type === "product" ? selectedItem.id : null,
          loose_stone_id:
            selectedItem.type === "loose_stone" ? selectedItem.id : null,
          requirement: requirement.trim() || null,
          fee: Number(fee || 0),
        }),
      }
    );
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "保存失败");
      return;
    }
    setOpen(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="h-4 w-4" />
            新增加工单
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{processing ? "编辑加工单" : "新增加工单"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {processing?.code && (
            <div className="space-y-2">
              <Label>加工单号</Label>
              <div className="flex h-10 items-center rounded-md border border-input bg-gray-50 px-3 font-mono text-sm text-gray-700">
                {processing.code}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="processing-ordered-at">下单日期 *</Label>
            <Input
              id="processing-ordered-at"
              type="date"
              value={orderedAt}
              onChange={(e) => setOrderedAt(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="processing-customer">客户名字 *</Label>
            <SearchSelect
              id="processing-customer"
              value={customerId}
              displayValue={selectedCustomer?.name ?? customerName}
              placeholder="搜索客户姓名 / 电话 / 微信"
              emptyText="暂无客户"
              options={customers.map((c) => ({
                id: c.id,
                keywords: [c.name, c.phone, c.wechat]
                  .filter(Boolean)
                  .join(" "),
              }))}
              onSelect={(id) => {
                setCustomerId(id);
                setCustomerName(customers.find((c) => c.id === id)?.name ?? "");
              }}
              onClear={() => {
                setCustomerId("");
                setCustomerName("");
              }}
              renderOption={(id) => {
                const c = customers.find((x) => x.id === id);
                if (!c) return null;
                return (
                  <>
                    <span className="truncate">{c.name}</span>
                    {(c.phone || c.wechat) && (
                      <span className="truncate text-xs text-gray-400">
                        {c.phone || c.wechat}
                      </span>
                    )}
                  </>
                );
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="processing-item">要加工的产品资料 *</Label>
            <SearchSelect
              id="processing-item"
              value={itemKey}
              displayValue={
                selectedItem ? `${selectedItem.code} ${selectedItem.name}` : ""
              }
              placeholder="搜索编号或名称（产品 / 裸石）"
              emptyText="暂无产品与裸石"
              options={itemOptions.map((o) => ({
                id: o.key,
                keywords: `${o.code} ${o.name}`,
              }))}
              onSelect={setItemKey}
              onClear={() => setItemKey("")}
              onOptionEnter={(key, e) => {
                const o = itemOptions.find((x) => x.key === key);
                if (o) setPreview({ product: o.preview, x: e.clientX, y: e.clientY });
              }}
              onOptionLeave={() => setPreview(null)}
              renderOption={(key) => {
                const o = itemOptions.find((x) => x.key === key);
                if (!o) return null;
                return (
                  <>
                    <span className="shrink-0 font-mono text-xs text-gray-500">
                      {o.code}
                    </span>
                    <span className="truncate">{o.name}</span>
                    <span
                      className={cn(
                        "ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs",
                        o.type === "loose_stone"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                      )}
                    >
                      {o.type === "loose_stone" ? "裸石" : "产品"}
                    </span>
                  </>
                );
              }}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="processing-requirement">加工要求</Label>
            <Textarea
              id="processing-requirement"
              rows={3}
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
              placeholder="如：改圈口 14 号，抛光翻新"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="processing-fee">加工费用 (元)</Label>
            <Input
              id="processing-fee"
              type="number"
              inputMode="decimal"
              min={0}
              value={fee}
              onChange={(e) => setFee(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "保存中..." : processing ? "保存" : "新增"}
          </Button>
        </DialogFooter>
      </DialogContent>
      {preview && (
        <ProductHoverPreview
          product={preview.product}
          x={preview.x}
          y={preview.y}
        />
      )}
    </Dialog>
  );
}
