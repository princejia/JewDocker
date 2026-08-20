"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ChevronDown, Plus } from "lucide-react";
import { Product, Customer, LooseStone } from "@/types";
import { formatProductCode, cn } from "@/lib/utils";
import { categoryLabel } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const PAYMENT_METHODS = ["现金", "微信", "支付宝", "银行转账", "信用卡"];
const NO_CUSTOMER = "__none__";

type ItemType = "product" | "loose_stone";
type SaleType = "sold" | "consignment";

type PickItem = {
  id: string;
  code: string;
  name: string;
  price: number;
  product?: Product;
};

const PREVIEW_WIDTH = 288;
const PREVIEW_HEIGHT = 180;

/** 产品下拉项的悬停预览：跟随鼠标定位，避开下拉框的 overflow-hidden 裁切 */
function ProductPreview({
  product,
  x,
  y,
}: {
  product: Product;
  x: number;
  y: number;
}) {
  const rows: [string, string | null][] = [
    [
      "重量",
      product.total_weight != null
        ? `${product.total_weight} ${product.weight_unit || "克(g)"}`
        : null,
    ],
    ["尺寸", product.size],
    ["镶嵌配石", product.inlaid_stones],
    ["宝石分类", categoryLabel(product.gemstone_category) || null],
    ["功能分类", categoryLabel(product.function_category) || null],
  ];

  return createPortal(
    <div
      className="pointer-events-none fixed z-[100] hidden w-72 gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-xl md:flex"
      style={{
        left: Math.min(x + 16, window.innerWidth - PREVIEW_WIDTH - 8),
        top: Math.min(y, window.innerHeight - PREVIEW_HEIGHT - 8),
      }}
    >
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-gray-50">
        {product.image_urls?.[0] ? (
          <Image
            src={product.image_urls[0]}
            alt={product.name}
            fill
            className="object-cover"
            sizes="80px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl text-gray-300">
            💎
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1 truncate text-sm font-semibold text-gray-900">
          {product.name}
        </p>
        <dl className="space-y-0.5 text-xs text-gray-600">
          {rows
            .filter(([, v]) => v)
            .map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <dt className="shrink-0 text-gray-400">{label}</dt>
                <dd className="truncate">{value}</dd>
              </div>
            ))}
        </dl>
      </div>
    </div>,
    document.body
  );
}

export function RecordSaleDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [stones, setStones] = useState<LooseStone[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [itemType, setItemType] = useState<ItemType>("product");
  const [saleType, setSaleType] = useState<SaleType>("sold");
  const [itemId, setItemId] = useState("");
  const [itemQuery, setItemQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const [customerId, setCustomerId] = useState(NO_CUSTOMER);
  const [salePrice, setSalePrice] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [soldAt, setSoldAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<{
    product: Product;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!open) return;
    // 接口单页上限 100，逐页拉全，保证搜索能覆盖所有在库产品
    (async () => {
      const all: Product[] = [];
      let current = 1;
      let pages = 1;
      do {
        const res = await fetch(
          `/api/products?status=in_stock&limit=100&page=${current}`,
          { cache: "no-store" }
        );
        if (!res.ok) break;
        const json = await res.json();
        all.push(...(json.data ?? []));
        pages = json.totalPages ?? 1;
        current += 1;
      } while (current <= pages);
      setProducts(all.filter((p) => !p.is_loaned));
    })();
    fetch("/api/loose-stones", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) =>
        setStones(
          (j.data ?? []).filter(
            (s: LooseStone) => s.sale_status !== "sold" && !s.is_loaned
          )
        )
      );
    fetch("/api/customers", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setCustomers(j.data ?? []));
  }, [open]);

  useEffect(() => {
    if (!pickerOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [pickerOpen]);

  function handleItemTypeChange(type: ItemType) {
    setItemType(type);
    setItemId("");
    setItemQuery("");
    setPickerOpen(false);
    setPreview(null);
    setSalePrice("");
  }

  function handleItemChange(id: string) {
    setItemId(id);
    setPreview(null);
    setPickerOpen(false);
    if (itemType === "product") {
      const p = products.find((x) => x.id === id);
      if (p && !salePrice) setSalePrice(String(p.price));
    } else {
      const s = stones.find((x) => x.id === id);
      if (s && !salePrice) setSalePrice(String(s.price));
    }
  }

  const pickList: PickItem[] =
    itemType === "product"
      ? products.map((p) => ({
          id: p.id,
          code: p.code ?? formatProductCode("P", p.created_at),
          name: p.name,
          price: Number(p.price),
          product: p,
        }))
      : stones.map((s) => ({
          id: s.id,
          code: s.code ?? formatProductCode("L", s.created_at),
          name: s.material || "裸石",
          price: Number(s.price),
        }));

  const query = itemQuery.trim().toLowerCase();
  const filteredItems = query
    ? pickList.filter(
        (it) =>
          it.code.toLowerCase().includes(query) ||
          it.name.toLowerCase().includes(query)
      )
    : pickList;

  const selectedItem = pickList.find((it) => it.id === itemId) ?? null;

  function reset() {
    setItemType("product");
    setSaleType("sold");
    setItemId("");
    setItemQuery("");
    setPickerOpen(false);
    setPreview(null);
    setCustomerId(NO_CUSTOMER);
    setSalePrice("");
    setPaymentMethod("");
    setNotes("");
  }

  async function handleSubmit() {
    setError(null);
    if (!itemId) {
      setError(itemType === "product" ? "请选择产品" : "请选择裸石");
      return;
    }
    if (!salePrice) {
      setError("请输入成交价");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: itemType === "product" ? itemId : null,
        loose_stone_id: itemType === "loose_stone" ? itemId : null,
        customer_id: customerId === NO_CUSTOMER ? null : customerId,
        sale_price: Number(salePrice),
        payment_method: paymentMethod || null,
        sold_at: soldAt,
        sale_status: saleType,
        notes: notes.trim() || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "保存失败");
      return;
    }
    reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          登记销售
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>登记销售</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>物品类型</Label>
              <Select
                value={itemType}
                onValueChange={(v) => handleItemTypeChange(v as ItemType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">产品</SelectItem>
                  <SelectItem value="loose_stone">裸石</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>销售方式</Label>
              <Select
                value={saleType}
                onValueChange={(v) => setSaleType(v as SaleType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sold">出售</SelectItem>
                  <SelectItem value="consignment">借售</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div
            className="space-y-2"
            ref={pickerRef}
            onKeyDown={(e) => {
              if (e.key === "Escape" && pickerOpen) {
                e.stopPropagation();
                setPickerOpen(false);
              }
            }}
          >
            <Label>{itemType === "product" ? "产品 *" : "裸石 *"}</Label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setPickerOpen((o) => !o)}
                className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {selectedItem ? (
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 font-mono text-xs text-gray-500">
                      {selectedItem.code}
                    </span>
                    <span className="truncate">{selectedItem.name}</span>
                  </span>
                ) : (
                  <span className="text-gray-400">
                    {itemType === "product" ? "选择在库产品" : "选择在库裸石"}
                  </span>
                )}
                <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
              </button>

              {pickerOpen && (
                <div className="absolute left-0 right-0 top-11 z-50 rounded-md border bg-white shadow-lg">
                  <div className="border-b p-2">
                    <Input
                      autoFocus
                      value={itemQuery}
                      onChange={(e) => setItemQuery(e.target.value)}
                      placeholder={
                        itemType === "product"
                          ? "搜索编号或名称"
                          : "搜索编号或材质"
                      }
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {filteredItems.length === 0 ? (
                      <p className="px-3 py-4 text-center text-sm text-gray-400">
                        {pickList.length === 0
                          ? itemType === "product"
                            ? "无在库产品"
                            : "无可售裸石"
                          : "无匹配项"}
                      </p>
                    ) : (
                      filteredItems.map((it) => (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => handleItemChange(it.id)}
                          onMouseEnter={
                            it.product
                              ? (e) =>
                                  setPreview({
                                    product: it.product as Product,
                                    x: e.clientX,
                                    y: e.clientY,
                                  })
                              : undefined
                          }
                          onMouseLeave={() => setPreview(null)}
                          className={cn(
                            "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-amber-50",
                            itemId === it.id && "bg-amber-100"
                          )}
                        >
                          <span className="shrink-0 font-mono text-xs text-gray-500">
                            {it.code}
                          </span>
                          <span className="truncate">{it.name}</span>
                          <span className="ml-auto shrink-0 text-xs text-gray-500">
                            ¥{it.price.toLocaleString()}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>客户</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger>
                <SelectValue placeholder="选择客户（可选）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CUSTOMER}>不指定客户</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sale-price">成交价 (¥) *</Label>
            <Input
              id="sale-price"
              type="number"
              step="0.01"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>付款方式</Label>
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger>
                <SelectValue placeholder="选择付款方式" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sold-at">成交时间</Label>
            <Input
              id="sold-at"
              type="date"
              value={soldAt}
              onChange={(e) => setSoldAt(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="sale-notes">备注</Label>
            <Textarea
              id="sale-notes"
              rows={3}
              placeholder="销售备注（可选）"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "保存中..." : "登记"}
          </Button>
        </DialogFooter>
      </DialogContent>
      {preview && (
        <ProductPreview
          product={preview.product}
          x={preview.x}
          y={preview.y}
        />
      )}
    </Dialog>
  );
}
