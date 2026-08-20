"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Customer, ProductSaleWithRelations } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
} from "@/components/ui/dialog";

const PAYMENT_METHODS = ["现金", "微信", "支付宝", "银行转账", "信用卡"];
const NO_CUSTOMER = "__none__";

export function SaleRowActions({ sale }: { sale: ProductSaleWithRelations }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [customerId, setCustomerId] = useState(sale.customer_id ?? NO_CUSTOMER);
  const [salePrice, setSalePrice] = useState(String(sale.sale_price ?? ""));
  const [paymentMethod, setPaymentMethod] = useState(sale.payment_method ?? "");
  const [saleStatus, setSaleStatus] = useState<"sold" | "consignment">(
    (sale.products?.sale_status ?? sale.loose_stones?.sale_status) ===
      "consignment"
      ? "consignment"
      : "sold"
  );
  const [soldAt, setSoldAt] = useState(sale.sold_at ?? "");
  const [notes, setNotes] = useState(sale.notes ?? "");

  useEffect(() => {
    if (!editOpen) return;
    fetch("/api/customers", { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setCustomers(j.data ?? []));
  }, [editOpen]);

  async function handleSave() {
    setError(null);
    if (!salePrice) {
      setError("请输入成交价");
      return;
    }
    setBusy(true);
    const res = await fetch(`/api/sales/${sale.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: customerId === NO_CUSTOMER ? null : customerId,
        sale_price: Number(salePrice),
        payment_method: paymentMethod || null,
        sold_at: soldAt || undefined,
        sale_status: saleStatus,
        notes: notes.trim() || null,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error || "保存失败");
      return;
    }
    setEditOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    setBusy(true);
    const res = await fetch(`/api/sales/${sale.id}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      setConfirmDelete(false);
      router.refresh();
    }
  }

  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="sm" onClick={() => setEditOpen(true)}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setConfirmDelete(true)}
        className="text-red-500 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>修改销售记录</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>销售方式</Label>
              <Select
                value={saleStatus}
                onValueChange={(v) => setSaleStatus(v as "sold" | "consignment")}
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
              <Label htmlFor="edit-sale-price">成交价 (¥) *</Label>
              <Input
                id="edit-sale-price"
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
              <Label htmlFor="edit-sold-at">成交时间</Label>
              <Input
                id="edit-sold-at"
                type="date"
                value={soldAt}
                onChange={(e) => setSoldAt(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-sale-notes">备注</Label>
              <Textarea
                id="edit-sale-notes"
                rows={3}
                placeholder="销售备注（可选）"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={busy}>
              {busy ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="确认删除这条销售记录？"
        description="删除后对应产品/裸石将恢复为在库状态。"
        confirmText="确认删除"
        loading={busy}
        onConfirm={handleDelete}
      />
    </div>
  );
}
