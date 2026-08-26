"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { Customer } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { formatDate } from "@/lib/utils";
import { CustomerHistoryDialog } from "@/components/customers/CustomerHistoryDialog";

const EMPTY_FORM = { name: "", phone: "", wechat: "", notes: "" };

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    const res = await fetch(`/api/customers?${params.toString()}`, {
      cache: "no-store",
    });
    const json = await res.json();
    setCustomers(json.data ?? []);
    setLoading(false);
  }, [search]);

  useEffect(() => {
    const t = setTimeout(fetchCustomers, 300);
    return () => clearTimeout(t);
  }, [fetchCustomers]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError(null);
    setOpen(true);
  }

  function openEdit(c: Customer) {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone ?? "",
      wechat: c.wechat ?? "",
      notes: c.notes ?? "",
    });
    setError(null);
    setOpen(true);
  }

  async function handleSave() {
    setError(null);
    if (!form.name.trim()) {
      setError("客户姓名必填");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name,
      phone: form.phone || null,
      wechat: form.wechat || null,
      notes: form.notes || null,
    };
    const res = await fetch(
      editing ? `/api/customers/${editing.id}` : "/api/customers",
      {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "保存失败");
      return;
    }
    setForm(EMPTY_FORM);
    setEditing(null);
    setOpen(false);
    fetchCustomers();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const res = await fetch(`/api/customers/${deleteTarget.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    if (res.ok) {
      setDeleteTarget(null);
      fetchCustomers();
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">客户管理</h1>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          新增客户
        </Button>
      </div>

      <Input
        placeholder="搜索客户姓名"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-sm"
      />

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {customers.length === 0 ? (
              <p className="rounded-xl border bg-white py-10 text-center text-sm text-gray-400">
                暂无客户
              </p>
            ) : (
              customers.map((c) => (
                <div key={c.id} className="rounded-xl border bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 truncate font-medium text-gray-900">
                      {c.name}
                    </p>
                    <span className="shrink-0 text-xs text-gray-400">
                      {formatDate(c.created_at)}
                    </span>
                  </div>

                  <div className="mt-1 space-y-0.5 text-xs text-gray-500">
                    {c.phone && (
                      <p>
                        电话：
                        <a
                          href={`tel:${c.phone}`}
                          className="text-amber-700 underline-offset-2 hover:underline"
                        >
                          {c.phone}
                        </a>
                      </p>
                    )}
                    {c.wechat && <p>微信：{c.wechat}</p>}
                    {c.notes && <p className="break-words">{c.notes}</p>}
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-1 border-t pt-2">
                    <CustomerHistoryDialog
                      customerId={c.id}
                      customerName={c.name}
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(c)}
                    >
                      <Pencil className="h-4 w-4" />
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(c)}
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
                  <TableHead>姓名</TableHead>
                  <TableHead>电话</TableHead>
                  <TableHead>微信</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-center text-gray-400"
                    >
                      暂无客户
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.phone || "-"}</TableCell>
                      <TableCell>{c.wechat || "-"}</TableCell>
                      <TableCell className="max-w-xs truncate text-gray-500">
                        {c.notes || "-"}
                      </TableCell>
                      <TableCell>{formatDate(c.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <CustomerHistoryDialog
                            customerId={c.id}
                            customerName={c.name}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(c)}
                          >
                            <Pencil className="h-4 w-4" />
                            编辑
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(c)}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "编辑客户" : "新增客户"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="c-name">客户姓名 *</Label>
              <Input
                id="c-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-phone">联系电话</Label>
              <Input
                id="c-phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-wechat">微信号</Label>
              <Input
                id="c-wechat"
                value={form.wechat}
                onChange={(e) => setForm({ ...form, wechat: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-notes">备注</Label>
              <Textarea
                id="c-notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="确认删除该客户？"
        description={`将永久删除客户「${deleteTarget?.name ?? ""}」，其关联销售记录的客户信息会被清空。此操作不可撤销。`}
        confirmText="确认删除"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </div>
  );
}
