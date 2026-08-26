"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Pencil, Recycle as RecycleIcon, Trash2 } from "lucide-react";
import { Product, Recycle } from "@/types";
import { Button } from "@/components/ui/button";
import { StatsCard } from "@/components/ui/StatsCard";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { RecycleFormDialog } from "@/components/recycles/RecycleFormDialog";
import { formatDate } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function RecyclesPage() {
  const [recycles, setRecycles] = useState<Recycle[]>([]);
  const [products, setProducts] = useState<Record<string, Product>>({});
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Recycle | null>(null);
  const [working, setWorking] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);

    // 产品接口单页上限 100，逐页拉全，用于把 product_ids 还原成产品名
    const allProducts: Product[] = [];
    let current = 1;
    let pages = 1;
    do {
      const res = await fetch(`/api/products?limit=100&page=${current}`, {
        cache: "no-store",
      });
      if (!res.ok) break;
      const json = await res.json();
      allProducts.push(...(json.data ?? []));
      pages = json.totalPages ?? 1;
      current += 1;
    } while (current <= pages);

    const map: Record<string, Product> = {};
    for (const p of allProducts) map[p.id] = p;

    const recycleRes = await fetch("/api/recycles", { cache: "no-store" });
    const recycleJson = await recycleRes.json();

    setRecycles(recycleJson.data ?? []);
    setProducts(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setWorking(true);
    const res = await fetch(`/api/recycles/${deleteTarget.id}`, {
      method: "DELETE",
    });
    setWorking(false);
    if (res.ok) {
      setDeleteTarget(null);
      fetchAll();
    }
  }

  const goldCount = recycles.filter((r) => r.category === "黄金").length;
  const stoneCount = recycles.filter((r) => r.category === "宝石").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">回收管理</h1>
        <RecycleFormDialog onSaved={fetchAll} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          title="回收总数"
          value={recycles.length}
          icon={RecycleIcon}
          accent="amber"
        />
        <StatsCard title="黄金" value={goldCount} accent="gray" />
        <StatsCard title="宝石" value={stoneCount} accent="blue" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {recycles.length === 0 ? (
              <p className="rounded-xl border bg-white py-10 text-center text-sm text-gray-400">
                暂无回收记录
              </p>
            ) : (
              recycles.map((r) => (
                <div key={r.id} className="rounded-xl border bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-gray-900">{r.category}</p>
                    <span className="shrink-0 text-xs text-gray-500">
                      {formatDate(r.recycled_at)}
                    </span>
                  </div>

                  {!!r.product_ids?.length && (
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {r.product_ids.map((id) => {
                        const p = products[id];
                        return p ? (
                          <Link
                            key={id}
                            href={`/products/${id}/view`}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
                          >
                            {p.name}
                          </Link>
                        ) : (
                          <span
                            key={id}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400"
                          >
                            已删除产品
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {r.notes && (
                    <p className="mt-2 break-words text-xs text-gray-500">
                      {r.notes}
                    </p>
                  )}

                  <div className="mt-3 flex justify-end gap-1 border-t pt-2">
                    <RecycleFormDialog
                      recycle={r}
                      onSaved={fetchAll}
                      trigger={
                        <Button variant="outline" size="sm">
                          <Pencil className="h-4 w-4" />
                        </Button>
                      }
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDeleteTarget(r)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden rounded-xl border bg-white md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>分类</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead>关联产品</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recycles.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-gray-400"
                    >
                      暂无回收记录
                    </TableCell>
                  </TableRow>
                ) : (
                  recycles.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {r.category}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {formatDate(r.recycled_at)}
                      </TableCell>
                      <TableCell>
                        {r.product_ids?.length ? (
                          <div className="flex flex-wrap gap-1">
                            {r.product_ids.map((id) => {
                              const p = products[id];
                              return p ? (
                                <Link
                                  key={id}
                                  href={`/products/${id}/view`}
                                  className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 hover:text-amber-700"
                                >
                                  {p.name}
                                </Link>
                              ) : (
                                <span
                                  key={id}
                                  className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-400"
                                >
                                  已删除产品
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-gray-600">
                        {r.notes || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <RecycleFormDialog
                            recycle={r}
                            onSaved={fetchAll}
                            trigger={
                              <Button variant="outline" size="sm">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            }
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeleteTarget(r)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="删除回收记录"
        description="删除后不可恢复，确认删除该回收记录吗？"
        confirmText="删除"
        loading={working}
        onConfirm={handleDelete}
      />
    </div>
  );
}
