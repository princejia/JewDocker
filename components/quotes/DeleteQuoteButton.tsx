"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

export function DeleteQuoteButton({
  quoteId,
  customerName,
  convertedCount,
}: {
  quoteId: string;
  customerName: string;
  convertedCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const res = await fetch(`/api/quotes/${quoteId}`, { method: "DELETE" });
    setLoading(false);
    setOpen(false);
    if (res.ok) router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
        aria-label={`删除 ${customerName} 的报价单`}
      >
        <Trash2 className="h-4 w-4" />
      </button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`删除「${customerName}」的报价单？`}
        description={
          convertedCount > 0
            ? `该报价单下的报价记录会一并删除，其中 ${convertedCount} 条已转为销售，对应的销售记录不会被删除。`
            : "该报价单下的报价记录会一并删除。"
        }
        confirmText="删除"
        loading={loading}
        onConfirm={handleDelete}
      />
    </>
  );
}
