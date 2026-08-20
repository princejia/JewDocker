"use client";

import { useEffect, useState } from "react";
import { Trash2, QrCode } from "lucide-react";
import { LooseStone } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/Combobox";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { FileUpload } from "@/components/ui/FileUpload";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GEMSTONE_CATEGORY_SUGGESTIONS } from "@/lib/constants";
import { saveLabelsPdf, stoneLabelItem } from "@/lib/labels";

const WEIGHT_UNIT_OPTIONS = ["克(g)", "克拉(ct)"];

type FormState = {
  image_urls: string[];
  certificate_urls: string[];
  material: string;
  gemstone_category: string;
  origin: string;
  certificate: string;
  size: string;
  weight: string;
  weight_unit: string;
  price: string;
  purchase_price: string;
  purchased_at: string;
  notes: string;
};

function toFormState(s?: LooseStone | null): FormState {
  return {
    image_urls: s?.image_urls ?? [],
    certificate_urls: s?.certificate_urls ?? [],
    material: s?.material ?? "",
    gemstone_category: s?.gemstone_category ?? "",
    origin: s?.origin ?? "",
    certificate: s?.certificate ?? "",
    size: s?.size ?? "",
    weight: s?.weight != null ? String(s.weight) : "",
    weight_unit: s?.weight_unit ?? "克(g)",
    price: s?.price != null ? String(s.price) : "",
    purchase_price: s?.purchase_price != null ? String(s.purchase_price) : "",
    purchased_at: s?.purchased_at ?? "",
    notes: s?.notes ?? "",
  };
}

interface LooseStoneFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: LooseStone | null;
  onSaved: () => void;
}

export function LooseStoneFormDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: LooseStoneFormDialogProps) {
  const [form, setForm] = useState<FormState>(toFormState(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gemstoneOptions, setGemstoneOptions] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(toFormState(initial));
      setError(null);
    }
  }, [open, initial]);

  useEffect(() => {
    if (!open) return;
    fetch("/api/options")
      .then((res) => res.json())
      .then((json) => setGemstoneOptions(json.gemstone_category ?? []))
      .catch(() => {});
  }, [open]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    setError(null);
    setSaving(true);

    const payload = {
      image_urls: form.image_urls,
      certificate_urls: form.certificate_urls,
      material: form.material || null,
      gemstone_category: form.gemstone_category || null,
      origin: form.origin || null,
      certificate: form.certificate || null,
      size: form.size || null,
      weight: form.weight === "" ? null : Number(form.weight),
      weight_unit: form.weight_unit || null,
      price: form.price === "" ? 0 : Number(form.price),
      purchase_price:
        form.purchase_price === "" ? 0 : Number(form.purchase_price),
      purchased_at: form.purchased_at || null,
      notes: form.notes || null,
    };

    const url = initial
      ? `/api/loose-stones/${initial.id}`
      : "/api/loose-stones";
    const method = initial ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setSaving(false);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "保存失败");
      return;
    }

    onOpenChange(false);
    onSaved();
  }

  async function handleDelete() {
    if (!initial) return;
    setDeleting(true);
    const res = await fetch(`/api/loose-stones/${initial.id}`, {
      method: "DELETE",
    });
    setDeleting(false);
    if (res.ok) {
      setConfirmDelete(false);
      onOpenChange(false);
      onSaved();
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{initial ? "编辑裸石" : "新增裸石"}</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>裸石图片</Label>
              <ImageUpload
                value={form.image_urls}
                onChange={(urls) => set("image_urls", urls)}
              />
            </div>
            <div className="space-y-2">
              <Label>认证报告</Label>
              <FileUpload
                value={form.certificate_urls}
                onChange={(urls) => set("certificate_urls", urls)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ls-material">产品名称</Label>
              <Input
                id="ls-material"
                value={form.material}
                maxLength={100}
                onChange={(e) => set("material", e.target.value)}
                placeholder="如：天然翡翠、矢车菊蓝宝"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ls-gemstone">宝石分类</Label>
              <Combobox
                id="ls-gemstone"
                value={form.gemstone_category}
                onChange={(v) => set("gemstone_category", v)}
                options={[...GEMSTONE_CATEGORY_SUGGESTIONS, ...gemstoneOptions]}
                placeholder="输入或选择宝石分类"
                maxLength={100}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ls-origin">产地</Label>
                <Input
                  id="ls-origin"
                  value={form.origin}
                  maxLength={100}
                  onChange={(e) => set("origin", e.target.value)}
                  placeholder="如：缅甸、斯里兰卡"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ls-certificate">证书</Label>
                <Input
                  id="ls-certificate"
                  value={form.certificate}
                  maxLength={255}
                  onChange={(e) => set("certificate", e.target.value)}
                  placeholder="如：GIA / 国检证书编号"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ls-size">尺寸</Label>
                <Input
                  id="ls-size"
                  value={form.size}
                  onChange={(e) => set("size", e.target.value)}
                  placeholder="如：10×8mm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="ls-weight">重量</Label>
                  <Input
                    id="ls-weight"
                    type="number"
                    step="0.001"
                    value={form.weight}
                    onChange={(e) => set("weight", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ls-weight-unit">单位</Label>
                  <Combobox
                    id="ls-weight-unit"
                    value={form.weight_unit}
                    onChange={(v) => set("weight_unit", v)}
                    options={WEIGHT_UNIT_OPTIONS}
                    placeholder="克(g)"
                    maxLength={20}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ls-price">价格 (¥)</Label>
                <Input
                  id="ls-price"
                  type="number"
                  step="0.01"
                  value={form.price}
                  onChange={(e) => set("price", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ls-purchase-price">进货价 (¥)</Label>
                <Input
                  id="ls-purchase-price"
                  type="number"
                  step="0.01"
                  value={form.purchase_price}
                  onChange={(e) => set("purchase_price", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ls-purchased-at">购入时间</Label>
                <Input
                  id="ls-purchased-at"
                  type="date"
                  value={form.purchased_at}
                  onChange={(e) => set("purchased_at", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ls-notes">备注</Label>
              <Textarea
                id="ls-notes"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <DialogFooter className="sm:justify-between">
            {initial ? (
              <Button
                variant="destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
                删除
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              {initial && (
                <Button
                  variant="outline"
                  onClick={() => saveLabelsPdf([stoneLabelItem(initial)])}
                >
                  <QrCode className="h-4 w-4" />
                  标签 PDF
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                取消
              </Button>
              <Button onClick={handleSubmit} disabled={saving}>
                {saving ? "保存中..." : "保存"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="确认删除这颗裸石？"
        description="此操作不可撤销，将永久删除该裸石记录。"
        confirmText="确认删除"
        loading={deleting}
        onConfirm={handleDelete}
      />
    </>
  );
}
