"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, LayoutGrid, List, Loader2, Download, QrCode } from "lucide-react";
import { LooseStone } from "@/types";
import { Button } from "@/components/ui/button";
import { exportLooseStonesToExcel } from "@/lib/export";
import { saveLabelsPdf } from "@/lib/labels";
import { formatProductCode } from "@/lib/utils";
import { LooseStoneCard } from "@/components/loose-stones/LooseStoneCard";
import { LooseStoneTable } from "@/components/loose-stones/LooseStoneTable";
import { LooseStoneFormDialog } from "@/components/loose-stones/LooseStoneFormDialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  LooseStoneFilters,
  LooseStoneFilterState,
  DEFAULT_LS_FILTERS,
} from "@/components/loose-stones/LooseStoneFilters";

export default function LooseStonesPage() {
  const [filters, setFilters] =
    useState<LooseStoneFilterState>(DEFAULT_LS_FILTERS);
  const [view, setView] = useState<"card" | "table">("card");
  const [stones, setStones] = useState<LooseStone[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LooseStone | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LooseStone | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchStones = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.search) params.set("search", filters.search);
    if (filters.gemstone_category)
      params.set("gemstone_category", filters.gemstone_category);
    if (filters.price_min) params.set("price_min", filters.price_min);
    if (filters.price_max) params.set("price_max", filters.price_max);
    params.set("sort_by", filters.sort_by);
    params.set("order", filters.order);

    const res = await fetch(`/api/loose-stones?${params.toString()}`, {
      cache: "no-store",
    });
    const json = await res.json();
    setStones(json.data ?? []);
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(fetchStones, 300);
    return () => clearTimeout(t);
  }, [fetchStones]);

  // 支持扫码跳转：URL 带 ?edit=<id> 时自动打开对应裸石的编辑弹窗
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const editId = params.get("edit");
    if (!editId) return;
    fetch(`/api/loose-stones/${editId}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (json.data) {
          setEditing(json.data as LooseStone);
          setOpen(true);
        }
      })
      .catch(() => {});
    window.history.replaceState(null, "", "/loose-stones");
  }, []);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(stone: LooseStone) {
    setEditing(stone);
    setOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/loose-stones/${deleteTarget.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    if (res.ok) {
      setDeleteTarget(null);
      fetchStones();
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl font-bold text-gray-900">裸石管理</h1>
          {!loading && (
            <span className="text-sm text-gray-500">共 {stones.length} 件</span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border bg-white">
            <button
              onClick={() => setView("card")}
              className={`flex items-center gap-1 px-3 py-2 text-sm ${
                view === "card"
                  ? "bg-amber-100 text-amber-900"
                  : "text-gray-500"
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
            onClick={() => exportLooseStonesToExcel(stones)}
            disabled={stones.length === 0}
          >
            <Download className="h-4 w-4" />
            导出 Excel
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              saveLabelsPdf(
                stones.map((s) => ({
                  id: s.id,
                  code: s.code ?? formatProductCode("L", s.created_at),
                  name: s.material || "未命名",
                  type: "stone" as const,
                })),
              )
            }
            disabled={stones.length === 0}
          >
            <QrCode className="h-4 w-4" />
            标签 PDF
          </Button>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" />
            新增裸石
          </Button>
        </div>
      </div>

      <LooseStoneFilters
        value={filters}
        onChange={setFilters}
        onReset={() => setFilters(DEFAULT_LS_FILTERS)}
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      ) : view === "card" ? (
        stones.length === 0 ? (
          <p className="py-20 text-center text-gray-400">暂无裸石</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {stones.map((s) => (
              <LooseStoneCard
                key={s.id}
                stone={s}
                onClick={() => openEdit(s)}
              />
            ))}
          </div>
        )
      ) : (
        <LooseStoneTable
          stones={stones}
          onEdit={openEdit}
          onDelete={(id) =>
            setDeleteTarget(stones.find((s) => s.id === id) ?? null)
          }
        />
      )}

      <LooseStoneFormDialog
        open={open}
        onOpenChange={setOpen}
        initial={editing}
        onSaved={fetchStones}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="确认删除这颗裸石？"
        description="此操作不可撤销，将永久删除该裸石记录。"
        confirmText="确认删除"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
