"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function NewQuoteDialog({
  customerNames,
}: {
  customerNames: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setError(null);
    if (!name.trim()) {
      setError("请输入客户名称");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/quotes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_name: name.trim(),
        notes: notes.trim() || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error || "创建失败");
      return;
    }
    const json = await res.json();
    setOpen(false);
    setName("");
    setNotes("");
    router.push(`/quotes/${json.data.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          新建报价
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>新建报价</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="quote-customer">客户名称 *</Label>
            <Input
              id="quote-customer"
              list="quote-customer-names"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入客户名称"
            />
            <datalist id="quote-customer-names">
              {customerNames.map((n) => (
                <option key={n} value={n} />
              ))}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label htmlFor="quote-notes">备注</Label>
            <Textarea
              id="quote-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "创建中..." : "创建并添加报价"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
