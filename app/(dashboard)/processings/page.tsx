"use client";

import { useCallback, useEffect, useState } from "react";
import { Hammer, Loader2, Pencil, Trash2, Wallet } from "lucide-react";
import { ProcessingWithRelations } from "@/types";
import {
  ProductHoverPreview,
  HoverPreview,
  PreviewProduct,
} from "@/components/products/ProductHoverPreview";
import { Button } from "@/components/ui/button";
import { StatsCard } from "@/components/ui/StatsCard";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ProcessingFormDialog } from "@/components/processings/ProcessingFormDialog";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** 加工单关联的产品或裸石，统一成悬停卡片需要的字段 */
function itemPreview(p: ProcessingWithRelations): PreviewProduct | null {
  if (p.products) {
    return {
      name: p.products.name,
      image_urls: p.products.image_urls,
      total_weight: p.products.total_weight,
      weight_unit: p.products.weight_unit,
      size: p.products.size,
      inlaid_stones: p.products.inlaid_stones,
      gemstone_category: p.products.gemstone_category,
      function_category: p.products.function_category,
    };
  }
  if (p.loose_stones) {
    return {
      name: p.loose_stones.material || "裸石",
      image_urls: p.loose_stones.image_urls,
      total_weight: p.loose_stones.weight,
      weight_unit: p.loose_stones.weight_unit,
      size: p.loose_stones.size,
      inlaid_stones: null,
      gemstone_category: p.loose_stones.gemstone_category,
      function_category: null,
    };
  }
  return null;
}

function itemLabel(p: ProcessingWithRelations): string {
  if (p.products) return p.products.name;
  if (p.loose_stones) return p.loose_stones.material || "裸石";
  return "已删除物品";
}

function itemCode(p: ProcessingWithRelations): string | null {
  return p.products?.code ?? p.loose_stones?.code ?? null;
}

export default function ProcessingsPage() {
  const [rows, setRows] = useState<ProcessingWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] =
    useState<ProcessingWithRelations | null>(null);
  const [working, setWorking] = useState(false);
  const [preview, setPreview] = useState<HoverPreview | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/processings", { cache: "no-store" });
    const json = await res.json();
    setRows(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  async function handleDelete() {
    if (!deleteTarget) return;
    setWorking(true);
    const res = await fetch(`/api/processings/${deleteTarget.id}`, {
      method: "DELETE",
    });
    setWorking(false);
    if (res.ok) {
      setDeleteTarget(null);
      fetchAll();
    }
  }

  const totalFee = rows.reduce((sum, r) => sum + Number(r.fee ?? 0), 0);

  function ItemCell({ p }: { p: ProcessingWithRelations }) {
    const pv = itemPreview(p);
    const code = itemCode(p);
    return (
      <span
        className="inline-flex items-center gap-2"
        onMouseEnter={(e) =>
          pv && setPreview({ product: pv, x: e.clientX, y: e.clientY })
        }
        onMouseLeave={() => setPreview(null)}
      >
        {code && (
          <span className="font-mono text-xs text-gray-500">{code}</span>
        )}
        <span className={pv ? "text-amber-700" : "text-gray-400"}>
          {itemLabel(p)}
        </span>
        {p.loose_stones && (
          <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
            裸石
          </span>
        )}
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">加工管理</h1>
        <ProcessingFormDialog onSaved={fetchAll} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatsCard
          title="加工单总数"
          value={rows.length}
          icon={Hammer}
          accent="amber"
        />
        <StatsCard
          title="加工费用合计"
          value={formatCurrency(totalFee)}
          icon={Wallet}
          accent="green"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {rows.length === 0 ? (
              <p className="rounded-xl border bg-white py-10 text-center text-sm text-gray-400">
                暂无加工单
              </p>
            ) : (
              rows.map((p) => (
                <div key={p.id} className="rounded-xl border bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm text-gray-900">
                        {p.code || "-"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {p.customer_name}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-gray-500">
                      {formatDate(p.ordered_at)}
                    </span>
                  </div>

                  <p className="mt-2.5 truncate text-sm text-gray-700">
                    {itemCode(p) ? `${itemCode(p)} ` : ""}
                    {itemLabel(p)}
                  </p>

                  {p.requirement && (
                    <p className="mt-1 break-words text-xs text-gray-500">
                      {p.requirement}
                    </p>
                  )}

                  <p className="mt-2 text-sm font-medium text-amber-700">
                    {formatCurrency(p.fee)}
                  </p>

                  <div className="mt-3 flex justify-end gap-1 border-t pt-2">
                    <ProcessingFormDialog
                      processing={p}
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
                      onClick={() => setDeleteTarget(p)}
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
                  <TableHead>加工单号</TableHead>
                  <TableHead>下单日期</TableHead>
                  <TableHead>客户名字</TableHead>
                  <TableHead>要加工的产品资料</TableHead>
                  <TableHead>加工要求</TableHead>
                  <TableHead>加工费用</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-gray-400">
                      暂无加工单
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-sm">
                        {p.code || "-"}
                      </TableCell>
                      <TableCell className="text-gray-600">
                        {formatDate(p.ordered_at)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {p.customer_name}
                      </TableCell>
                      <TableCell>
                        <ItemCell p={p} />
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-gray-600">
                        {p.requirement || "-"}
                      </TableCell>
                      <TableCell className="text-gray-900">
                        {formatCurrency(p.fee)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <ProcessingFormDialog
                            processing={p}
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
                            onClick={() => setDeleteTarget(p)}
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
        title="删除加工单"
        description="删除后不可恢复，确认删除该加工单吗？"
        confirmText="删除"
        loading={working}
        onConfirm={handleDelete}
      />

      {preview && (
        <ProductHoverPreview
          product={preview.product}
          x={preview.x}
          y={preview.y}
        />
      )}
    </div>
  );
}
