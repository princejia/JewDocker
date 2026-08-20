"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, LayoutGrid, List, Loader2, Download, QrCode } from "lucide-react";
import { Product, PaginatedResponse } from "@/types";
import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/products/ProductCard";
import { ProductTable } from "@/components/products/ProductTable";
import { exportProductsToExcel } from "@/lib/export";
import { saveLabelsPdf } from "@/lib/labels";
import { formatProductCode } from "@/lib/utils";
import {
  ProductFilters,
  ProductFilterState,
  DEFAULT_FILTERS,
} from "@/components/products/ProductFilters";

export default function ProductsPage() {
  const [filters, setFilters] = useState<ProductFilterState>(DEFAULT_FILTERS);
  const [view, setView] = useState<"card" | "table">("card");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [selected, setSelected] = useState<Record<string, Product>>({});

  const selectedList = Object.values(selected);
  const selectedCount = selectedList.length;
  const selectedIds = new Set(Object.keys(selected));

  function toggleSelect(p: Product) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[p.id]) delete next[p.id];
      else next[p.id] = p;
      return next;
    });
  }

  function toggleSelectAll(list: Product[], checked: boolean) {
    setSelected((prev) => {
      const next = { ...prev };
      for (const p of list) {
        if (checked) next[p.id] = p;
        else delete next[p.id];
      }
      return next;
    });
  }

  const buildFilterParams = useCallback(() => {
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.is_loose_stone !== "all")
      params.set("is_loose_stone", filters.is_loose_stone);
    if (filters.gemstone_category !== "all")
      params.set("gemstone_category", filters.gemstone_category);
    if (filters.price_min) params.set("price_min", filters.price_min);
    if (filters.price_max) params.set("price_max", filters.price_max);
    params.set("sort_by", filters.sort_by);
    params.set("order", filters.order);
    return params;
  }, [filters]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const params = buildFilterParams();
    params.set("page", String(page));
    params.set("limit", "20");

    const res = await fetch(`/api/products?${params.toString()}`, {
      cache: "no-store",
    });
    const json: PaginatedResponse<Product> = await res.json();
    setProducts(json.data ?? []);
    setTotal(json.total ?? 0);
    setTotalPages(json.totalPages ?? 1);
    setLoading(false);
  }, [buildFilterParams, page]);

  useEffect(() => {
    const t = setTimeout(fetchProducts, 300);
    return () => clearTimeout(t);
  }, [fetchProducts]);

  /** 按当前筛选条件抓取全部产品（接口单页上限 100，逐页拉取） */
  const fetchAllProducts = useCallback(async () => {
    const all: Product[] = [];
    let current = 1;
    let pages = 1;
    do {
      const params = buildFilterParams();
      params.set("page", String(current));
      params.set("limit", "100");
      const res = await fetch(`/api/products?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) break;
      const json: PaginatedResponse<Product> = await res.json();
      all.push(...(json.data ?? []));
      pages = json.totalPages ?? 1;
      current += 1;
    } while (current <= pages);
    return all;
  }, [buildFilterParams]);

  /** 导出/打印的范围：有勾选则仅包含勾选项，否则为当前筛选的全部 */
  async function resolveExportTargets() {
    return selectedCount > 0 ? selectedList : await fetchAllProducts();
  }

  async function handleExportExcel() {
    setExporting("excel");
    try {
      exportProductsToExcel(await resolveExportTargets());
    } finally {
      setExporting(null);
    }
  }

  async function handleExportLabels() {
    setExporting("pdf");
    try {
      const targets = await resolveExportTargets();
      await saveLabelsPdf(
        targets.map((p) => ({
          id: p.id,
          code: p.code ?? formatProductCode("P", p.created_at),
          name: p.name,
          type: "product" as const,
        })),
      );
    } finally {
      setExporting(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl font-bold text-gray-900">产品管理</h1>
          {!loading && (
            <span className="text-sm text-gray-500">共 {total} 件</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border bg-white">
            <button
              onClick={() => setView("card")}
              className={`flex items-center gap-1 px-3 py-2 text-sm ${
                view === "card" ? "bg-amber-100 text-amber-900" : "text-gray-500"
              }`}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("table")}
              className={`flex items-center gap-1 px-3 py-2 text-sm ${
                view === "table"
                  ? "bg-amber-100 text-amber-900"
                  : "text-gray-500"
              }`}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
          <Button
            variant="outline"
            onClick={handleExportExcel}
            disabled={total === 0 || exporting !== null}
          >
            {exporting === "excel" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            导出 Excel{selectedCount > 0 ? `（${selectedCount}）` : ""}
          </Button>
          <Button
            variant="outline"
            onClick={handleExportLabels}
            disabled={total === 0 || exporting !== null}
          >
            {exporting === "pdf" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <QrCode className="h-4 w-4" />
            )}
            标签 PDF{selectedCount > 0 ? `（${selectedCount}）` : ""}
          </Button>
          <Button asChild>
            <Link href="/products/new">
              <Plus className="h-4 w-4" />
              新增产品
            </Link>
          </Button>
        </div>
      </div>
      <ProductFilters
        value={filters}
        onChange={(next) => {
          setPage(1);
          setFilters(next);
        }}
        onReset={() => {
          setPage(1);
          setFilters(DEFAULT_FILTERS);
        }}
      />

      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          <span>
            已选 <strong>{selectedCount}</strong> 件，导出 Excel
            与标签 PDF 仅包含勾选项
          </span>
          <button
            onClick={() => setSelected({})}
            className="underline hover:text-amber-700"
          >
            清空选择
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      ) : view === "card" ? (
        products.length === 0 ? (
          <p className="py-20 text-center text-gray-400">暂无产品</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                selected={selectedIds.has(p.id)}
                onToggleSelect={toggleSelect}
              />
            ))}
          </div>
        )
      ) : (
        <ProductTable
          products={products}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
        />
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            上一页
          </Button>
          <span className="text-sm text-gray-500">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  );
}
