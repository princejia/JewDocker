"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus } from "lucide-react";
import { Product, Customer, LooseStone } from "@/types";
import { formatProductCode } from "@/lib/utils";
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

const PAYMENT_METHODS = ["现金", "微信", "支付宝", "银行转账"];
const NO_CUSTOMER = "__none__";

type ItemType = "product" | "loose_stone";
type SaleType = "sold" | "consignment";

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
    fetch("/api/products?status=in_stock&limit=100", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) =>
        setProducts((j.data ?? []).filter((p: Product) => !p.is_loaned))
      );
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

  function handleItemTypeChange(type: ItemType) {
    setItemType(type);
    setItemId("");
    setSalePrice("");
  }

  function handleItemChange(id: string) {
    setItemId(id);
    setPreview(null);
    if (itemType === "product") {
      const p = products.find((x) => x.id === id);
      if (p && !salePrice) setSalePrice(String(p.price));
    } else {
      const s = stones.find((x) => x.id === id);
      if (s && !salePrice) setSalePrice(String(s.price));
    }
  }

  function reset() {
    setItemType("product");
    setSaleType("sold");
    setItemId("");
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

          <div className="space-y-2">
            <Label>{itemType === "product" ? "产品 *" : "裸石 *"}</Label>
            <Select
              value={itemId}
              onValueChange={handleItemChange}
              onOpenChange={(o) => !o && setPreview(null)}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    itemType === "product" ? "选择在库产品" : "选择在库裸石"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {itemType === "product" ? (
                  products.length === 0 ? (
                    <SelectItem value="__empty__" disabled>
                      无在库产品
                    </SelectItem>
                  ) : (
                    products.map((p) => (
                      <SelectItem
                        key={p.id}
                        value={p.id}
                        onMouseEnter={(e) =>
                          setPreview({
                            product: p,
                            x: e.clientX,
                            y: e.clientY,
                          })
                        }
                        onMouseLeave={() => setPreview(null)}
                      >
                        <span className="font-mono text-gray-500">
                          {p.code ?? formatProductCode("P", p.created_at)}
                        </span>{" "}
                        {p.name}（¥{Number(p.price).toLocaleString()}）
                      </SelectItem>
                    ))
                  )
                ) : stones.length === 0 ? (
                  <SelectItem value="__empty__" disabled>
                    无可售裸石
                  </SelectItem>
                ) : (
                  stones.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="font-mono text-gray-500">
                        {s.code ?? formatProductCode("L", s.created_at)}
                      </span>{" "}
                      {(s.material || "裸石") +
                        `（¥${Number(s.price).toLocaleString()}）`}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
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
