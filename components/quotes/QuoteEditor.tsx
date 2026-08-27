"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Trash2 } from "lucide-react";
import { Product, QuoteItemWithProduct, QuoteWithItems } from "@/types";
import { formatCurrency, formatDateTime, formatProductCode, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PickItem = { id: string; code: string; name: string; price: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function QuoteEditor({ quote }: { quote: QuoteWithItems }) {
  const router = useRouter();

  const [customerName, setCustomerName] = useState(quote.customer_name);
  const [savingName, setSavingName] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const [listPrice, setListPrice] = useState("");
  const [discount, setDiscount] = useState("1");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuoteItemWithProduct | null>(
    null,
  );

  useEffect(() => {
    // 接口单页上限 100，逐页拉全，保证搜索覆盖所有在库产品
    (async () => {
      const all: Product[] = [];
      let current = 1;
      let pages = 1;
      do {
        const res = await fetch(
          `/api/products?status=in_stock&limit=100&page=${current}`,
          { cache: "no-store" },
        );
        if (!res.ok) break;
        const json = await res.json();
        all.push(...(json.data ?? []));
        pages = json.totalPages ?? 1;
        current += 1;
      } while (current <= pages);
      setProducts(all.filter((p) => !p.is_loaned));
    })();
  }, []);

  useEffect(() => {
    if (!pickerOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (!pickerRef.current?.contains(e.target as Node)) setPickerOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [pickerOpen]);

  const items = useMemo(
    () =>
      [...(quote.quote_items ?? [])].sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      ),
    [quote.quote_items],
  );

  const total = items.reduce((s, i) => s + Number(i.quoted_price || 0), 0);

  const pickList: PickItem[] = products.map((p) => ({
    id: p.id,
    code: p.code ?? formatProductCode("P", p.created_at),
    name: p.name,
    price: Number(p.price),
  }));

  const kw = query.trim().toLowerCase();
  const filtered = kw
    ? pickList.filter(
        (it) =>
          it.code.toLowerCase().includes(kw) ||
          it.name.toLowerCase().includes(kw),
      )
    : pickList;

  const selected = pickList.find((it) => it.id === productId) ?? null;

  const amount = round2(Number(listPrice || 0) * Number(discount || 0));

  function selectProduct(id: string) {
    setProductId(id);
    setPickerOpen(false);
    const p = pickList.find((x) => x.id === id);
    if (p) setListPrice(String(p.price));
  }

  async function saveCustomerName() {
    if (!customerName.trim()) return;
    setSavingName(true);
    await fetch(`/api/quotes/${quote.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customer_name: customerName.trim() }),
    });
    setSavingName(false);
    router.refresh();
  }

  async function addItem() {
    setError(null);
    if (!productId) {
      setError("请选择产品");
      return;
    }
    setAdding(true);
    const res = await fetch("/api/quote-items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quote_id: quote.id,
        product_id: productId,
        list_price: Number(listPrice || 0),
        discount: Number(discount || 0),
        quoted_price: amount,
      }),
    });
    setAdding(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "报价失败");
      return;
    }
    setProductId("");
    setQuery("");
    setListPrice("");
    setDiscount("1");
    router.refresh();
  }

  async function convert(item: QuoteItemWithProduct) {
    setError(null);
    setBusyItemId(item.id);
    const res = await fetch(`/api/quote-items/${item.id}/convert`, {
      method: "POST",
    });
    setBusyItemId(null);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "转销售失败");
      return;
    }
    router.refresh();
  }

  async function removeItem() {
    if (!deleteTarget) return;
    setBusyItemId(deleteTarget.id);
    const res = await fetch(`/api/quote-items/${deleteTarget.id}`, {
      method: "DELETE",
    });
    setBusyItemId(null);
    setDeleteTarget(null);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "删除失败");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/quotes"
            className="rounded-lg border p-2 text-gray-600 hover:bg-gray-50"
            aria-label="返回报价列表"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">报价详情</h1>
        </div>
        <p className="text-sm text-gray-500">
          创建于 {formatDateTime(quote.created_at)}
        </p>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1 space-y-2">
            <Label htmlFor="customer-name">客户名称</Label>
            <Input
              id="customer-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            onClick={saveCustomerName}
            disabled={savingName || customerName.trim() === quote.customer_name}
          >
            {savingName ? "保存中..." : "保存"}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <h2 className="text-base font-semibold text-gray-900">添加报价</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] md:items-end">
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
            <Label>产品 *</Label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setPickerOpen((o) => !o)}
                className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {selected ? (
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="shrink-0 font-mono text-xs text-gray-500">
                      {selected.code}
                    </span>
                    <span className="truncate">{selected.name}</span>
                  </span>
                ) : (
                  <span className="text-gray-400">选择在库产品</span>
                )}
                <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
              </button>

              {pickerOpen && (
                <div className="absolute left-0 right-0 top-11 z-50 rounded-md border bg-white shadow-lg">
                  <div className="border-b p-2">
                    <Input
                      autoFocus
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="搜索编号或名称"
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto">
                    {filtered.length === 0 ? (
                      <p className="px-3 py-4 text-center text-sm text-gray-400">
                        {pickList.length === 0 ? "无在库产品" : "无匹配项"}
                      </p>
                    ) : (
                      filtered.map((it) => (
                        <button
                          key={it.id}
                          type="button"
                          onClick={() => selectProduct(it.id)}
                          className={cn(
                            "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-amber-50",
                            productId === it.id && "bg-amber-100",
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
            <Label htmlFor="list-price">产品金额</Label>
            <Input
              id="list-price"
              type="number"
              inputMode="decimal"
              value={listPrice}
              onChange={(e) => setListPrice(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="discount">折扣</Label>
            <Input
              id="discount"
              type="number"
              inputMode="decimal"
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              placeholder="0.85 = 85 折"
            />
          </div>

          <div className="space-y-2">
            <Label>报价金额</Label>
            <div className="flex h-10 items-center rounded-md border border-input bg-gray-50 px-3 text-sm font-semibold text-amber-700">
              {formatCurrency(amount)}
            </div>
          </div>

          <Button onClick={addItem} disabled={adding}>
            {adding ? "报价中..." : "报价"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-gray-400">
          折扣为乘数：1 = 原价，0.85 = 85 折
        </p>
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      </div>

      <div className="rounded-xl border bg-white">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">报价记录</h2>
          <span className="text-sm text-gray-500">
            共 {items.length} 件 · 合计{" "}
            <span className="font-semibold text-amber-700">
              {formatCurrency(total)}
            </span>
          </span>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>产品</TableHead>
              <TableHead className="text-right">产品金额</TableHead>
              <TableHead className="text-right">折扣</TableHead>
              <TableHead className="text-right">报价金额</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-400">
                  还没有报价记录
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.products ? (
                      <Link
                        href={`/products/${item.products.id}/view`}
                        className="text-amber-700 hover:underline"
                      >
                        <span className="mr-2 font-mono text-xs text-gray-500">
                          {item.products.code}
                        </span>
                        {item.products.name}
                      </Link>
                    ) : (
                      "已删除产品"
                    )}
                  </TableCell>
                  <TableCell className="text-right text-gray-600">
                    {formatCurrency(item.list_price)}
                  </TableCell>
                  <TableCell className="text-right text-gray-600">
                    {Number(item.discount)}
                  </TableCell>
                  <TableCell className="text-right font-medium text-amber-700">
                    {formatCurrency(item.quoted_price)}
                  </TableCell>
                  <TableCell>
                    {item.sale_id ? (
                      <span className="text-green-700">已转销售</span>
                    ) : (
                      <span className="text-gray-500">报价中</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {!item.sale_id && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => convert(item)}
                            disabled={busyItemId === item.id}
                          >
                            转为销售
                          </Button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(item)}
                            className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
                            aria-label="删除报价记录"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="删除这条报价记录？"
        description={deleteTarget?.products?.name ?? undefined}
        confirmText="删除"
        loading={busyItemId === deleteTarget?.id}
        onConfirm={removeItem}
      />
    </div>
  );
}
