"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Trash2,
  ArrowLeftRight,
  RotateCcw,
  Undo2,
} from "lucide-react";
import { ItemLoanWithRelations } from "@/types";
import { Button } from "@/components/ui/button";
import { StatsCard } from "@/components/ui/StatsCard";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { LoanFormDialog } from "@/components/loans/LoanFormDialog";
import { formatDate } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function LoansPage() {
  const [loans, setLoans] = useState<ItemLoanWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [returnTarget, setReturnTarget] =
    useState<ItemLoanWithRelations | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<ItemLoanWithRelations | null>(null);
  const [working, setWorking] = useState(false);

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/loans", { cache: "no-store" });
    const json = await res.json();
    setLoans(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  async function handleReturn() {
    if (!returnTarget) return;
    setWorking(true);
    const res = await fetch(`/api/loans/${returnTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        returned_at: new Date().toISOString().slice(0, 10),
      }),
    });
    setWorking(false);
    if (res.ok) {
      setReturnTarget(null);
      fetchLoans();
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setWorking(true);
    const res = await fetch(`/api/loans/${deleteTarget.id}`, {
      method: "DELETE",
    });
    setWorking(false);
    if (res.ok) {
      setDeleteTarget(null);
      fetchLoans();
    }
  }

  const activeCount = loans.filter((l) => !l.returned_at).length;
  const returnedCount = loans.length - activeCount;

  function itemName(l: ItemLoanWithRelations) {
    return l.products?.name ?? l.loose_stones?.material ?? "已删除物品";
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">借调管理</h1>
        <LoanFormDialog onSaved={fetchLoans} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          title="借调总数"
          value={loans.length}
          icon={ArrowLeftRight}
          accent="amber"
        />
        <StatsCard
          title="借出中"
          value={activeCount}
          icon={Undo2}
          accent="blue"
        />
        <StatsCard
          title="已归还"
          value={returnedCount}
          icon={RotateCcw}
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
            {loans.length === 0 ? (
              <p className="rounded-xl border bg-white py-10 text-center text-sm text-gray-400">
                暂无借调记录
              </p>
            ) : (
              loans.map((l) => (
                <div key={l.id} className="rounded-xl border bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {l.products ? (
                        <Link
                          href={`/products/${l.products.id}/view`}
                          className="block truncate font-medium text-amber-700"
                        >
                          {l.products.name}
                        </Link>
                      ) : l.loose_stones ? (
                        <Link
                          href={`/loose-stones/${l.loose_stones.id}/view`}
                          className="block truncate font-medium text-amber-700"
                        >
                          {itemName(l)}
                        </Link>
                      ) : (
                        <p className="truncate font-medium text-gray-900">
                          {itemName(l)}
                        </p>
                      )}
                      <p className="mt-0.5 text-xs text-gray-500">
                        {l.borrower_name}
                        {l.borrower_contact ? ` · ${l.borrower_contact}` : ""}
                      </p>
                    </div>
                    {l.returned_at ? (
                      <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        已归还
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                        借出中
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-1.5 text-xs">
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                      {l.loose_stones ? "裸石" : "产品"}
                    </span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                      借出 {formatDate(l.loaned_at)}
                    </span>
                    {l.due_at && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                        预计归还 {formatDate(l.due_at)}
                      </span>
                    )}
                  </div>

                  <div className="mt-3 flex justify-end gap-1 border-t pt-2">
                    {!l.returned_at && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setReturnTarget(l)}
                      >
                        <RotateCcw className="h-4 w-4 text-green-600" />
                        归还
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(l)}
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
                  <TableHead>物品</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>借出人</TableHead>
                  <TableHead>联系方式</TableHead>
                  <TableHead>借出日期</TableHead>
                  <TableHead>预计归还</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center text-gray-400"
                    >
                      暂无借调记录
                    </TableCell>
                  </TableRow>
                ) : (
                  loans.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">
                        {l.products ? (
                          <Link
                            href={`/products/${l.products.id}/view`}
                            className="text-amber-700 hover:underline"
                          >
                            {l.products.name}
                          </Link>
                        ) : l.loose_stones ? (
                          <Link
                            href={`/loose-stones/${l.loose_stones.id}/view`}
                            className="text-amber-700 hover:underline"
                          >
                            {itemName(l)}
                          </Link>
                        ) : (
                          itemName(l)
                        )}
                      </TableCell>
                      <TableCell>
                        {l.loose_stones ? (
                          <span className="text-blue-600">裸石</span>
                        ) : (
                          "产品"
                        )}
                      </TableCell>
                      <TableCell>{l.borrower_name}</TableCell>
                      <TableCell>{l.borrower_contact || "-"}</TableCell>
                      <TableCell>{formatDate(l.loaned_at)}</TableCell>
                      <TableCell>
                        {l.due_at ? formatDate(l.due_at) : "-"}
                      </TableCell>
                      <TableCell>
                        {l.returned_at ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                            已归还
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                            借出中
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {!l.returned_at && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setReturnTarget(l)}
                            >
                              <RotateCcw className="h-4 w-4 text-green-600" />
                              归还
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(l)}
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
        open={!!returnTarget}
        onOpenChange={(o) => !o && setReturnTarget(null)}
        title="确认归还该物品？"
        description="将把该借调记录标记为已归还。"
        confirmText="确认归还"
        loading={working}
        onConfirm={handleReturn}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="确认删除该借调记录？"
        description="此操作不可撤销。"
        confirmText="确认删除"
        loading={working}
        onConfirm={handleDelete}
      />
    </div>
  );
}
