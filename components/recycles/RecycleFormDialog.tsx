"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Product, Recycle, RECYCLE_CATEGORIES, RecycleCategory } from "@/types";
import { formatProductCode, cn } from "@/lib/utils";
import {
  ProductHoverPreview,
  HoverPreview,
} from "@/components/products/ProductHoverPreview";
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

interface Props {
  recycle?: Recycle;
  trigger?: React.ReactNode;
  onSaved: () => void;
}

export function RecycleFormDialog({ recycle, trigger, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<HoverPreview | null>(null);

  const [category, setCategory] = useState<RecycleCategory>("黄金");
  const [recycledAt, setRecycledAt] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [productIds, setProductIds] = useState<string[]>([]);
  const [productQuery, setProductQuery] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setCategory(recycle?.category ?? "黄金");
    setRecycledAt(recycle?.recycled_at ?? new Date().toISOString().slice(0, 10));
    setProductIds(recycle?.product_ids ?? []);
    setNotes(recycle?.notes ?? "");
    setProductQuery("");
    setError(null);
  }, [open, recycle]);

  useEffect(() => {
    if (!open) return;
    // 接口单页上限 100，逐页拉全，保证搜索能覆盖所有产品
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

  const query = productQuery.trim().toLowerCase();
  const filtered = products.filter((p) => {
    if (!query) return true;
    const code = p.code ?? formatProductCode("P", p.created_at);
    return (
      code.toLowerCase().includes(query) || p.name.toLowerCase().includes(query)
    );
  });
  const selectedProducts = productIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is Product => !!p);

  function toggleProduct(id: string) {
    setProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit() {
    setError(null);
    setSaving(true);
    const res = await fetch(
      recycle ? `/api/recycles/${recycle.id}` : "/api/recycles",
      {
        method: recycle ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          recycled_at: recycledAt,
          product_ids: productIds,
          notes: notes.trim() || null,
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
            登记回收
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{recycle ? "编辑回收记录" : "登记回收"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>分类 *</Label>
              <Select
                value={category}
                onValueChange={(v) => setCategory(v as RecycleCategory)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECYCLE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="recycled-at">日期 *</Label>
              <Input
                id="recycled-at"
                type="date"
                value={recycledAt}
                onChange={(e) => setRecycledAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>关联产品（可多选）</Label>
            {selectedProducts.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedProducts.map((p) => (
                  <span
                    key={p.id}
                    className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900"
                  >
                    {p.name}
                    <button
                      type="button"
                      onClick={() => toggleProduct(p.id)}
                      aria-label={`移除 ${p.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <Input
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              placeholder="搜索编号或产品名称"
            />
            <div className="max-h-48 overflow-y-auto rounded-md border">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-gray-400">
                  {products.length === 0 ? "暂无产品" : "无匹配项"}
                </p>
              ) : (
                filtered.map((p) => {
                  const checked = productIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggleProduct(p.id)}
                      onMouseEnter={(e) =>
                        setPreview({ product: p, x: e.clientX, y: e.clientY })
                      }
                      onMouseLeave={() => setPreview(null)}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-amber-50",
                        checked && "bg-amber-100"
                      )}
                    >
                      <span
                        className={cn(
                          "h-3.5 w-3.5 shrink-0 rounded border",
                          checked
                            ? "border-amber-600 bg-amber-600"
                            : "border-gray-300"
                        )}
                      />
                      <span className="shrink-0 font-mono text-xs text-gray-500">
                        {p.code ?? formatProductCode("P", p.created_at)}
                      </span>
                      <span className="truncate">{p.name}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recycle-notes">备注</Label>
            <Textarea
              id="recycle-notes"
              rows={3}
              placeholder="回收备注（可选）"
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
            {saving ? "保存中..." : recycle ? "保存" : "登记"}
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
