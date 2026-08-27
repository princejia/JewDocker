"use client";

import { useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";
import { ProductSaleWithRelations } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";

export function CustomerHistoryDialog({
  customerId,
  customerName,
}: {
  customerId: string;
  customerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState<ProductSaleWithRelations[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/sales?customer_id=${customerId}`)
      .then((r) => r.json())
      .then((j) => setSales(j.data ?? []))
      .finally(() => setLoading(false));
  }, [open, customerId]);

  const total = sales.reduce((s, r) => s + Number(r.sale_price || 0), 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <History className="h-4 w-4" />
        购买历史
      </Button>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{customerName} 的购买历史</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
          </div>
        ) : sales.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">暂无购买记录</p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>物品</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead className="text-right">成交价</TableHead>
                  <TableHead>付款方式</TableHead>
                  <TableHead>成交时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      {s.products?.name ??
                        s.loose_stones?.material ??
                        "已删除记录"}
                    </TableCell>
                    <TableCell>
                      {s.loose_stones ? (
                        <span className="text-blue-600">裸石</span>
                      ) : (
                        "产品"
                      )}
                    </TableCell>
                    <TableCell className="text-right text-amber-700">
                      {formatCurrency(s.sale_price)}
                    </TableCell>
                    <TableCell>{s.payment_method || "-"}</TableCell>
                    <TableCell>{formatDate(s.sold_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-right text-sm text-gray-600">
              共 {sales.length} 笔，累计{" "}
              <span className="font-semibold text-amber-700">
                {formatCurrency(total)}
              </span>
            </p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
