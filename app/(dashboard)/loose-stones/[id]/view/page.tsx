import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { createServerClient } from "@/lib/supabase-server";
import { LooseStone } from "@/types";
import { Gallery } from "@/app/v/[type]/[id]/Gallery";
import { BackButton } from "@/components/products/BackButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { categoryLabel } from "@/lib/constants";
import { formatCurrency, formatDate, formatProductCode } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Field = { label: string; value: string | null | undefined };

export default async function LooseStoneViewPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("loose_stones")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!data) notFound();
  const stone = data as LooseStone;

  const title = stone.material || "未命名裸石";

  const fields: Field[] = [
    {
      label: "重量",
      value:
        stone.weight != null
          ? `${stone.weight}${stone.weight_unit || "g"}`
          : null,
    },
    { label: "尺寸", value: stone.size },
    { label: "产地", value: stone.origin },
    { label: "宝石分类", value: categoryLabel(stone.gemstone_category) },
    { label: "证书", value: stone.certificate },
    { label: "价格", value: formatCurrency(stone.price) },
    { label: "进货价", value: formatCurrency(stone.purchase_price) },
    { label: "售出价", value: formatCurrency(stone.sale_price) },
    {
      label: "利润",
      value:
        stone.sale_status === "sold"
          ? formatCurrency(
              Number(stone.sale_price || 0) - Number(stone.purchase_price || 0),
            )
          : null,
    },
    { label: "购入时间", value: formatDate(stone.purchased_at) },
    { label: "卖出时间", value: formatDate(stone.sold_at) },
    { label: "备注", value: stone.notes },
  ];

  const visible = fields.filter((f) => f.value);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <BackButton />

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <StatusBadge status={stone.sale_status} />
          </div>
          <p className="mt-1 font-mono text-sm text-gray-400">
            编号：{stone.code ?? formatProductCode("L", stone.created_at)}
          </p>
        </div>
        <Link
          href={`/loose-stones?edit=${stone.id}`}
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          <Pencil className="h-4 w-4" />
          编辑
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <Gallery images={stone.image_urls ?? []} title={title} />

        <div className="p-6">
          {visible.length > 0 && (
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {visible.map((f) => (
                <div key={f.label}>
                  <dt className="text-xs text-gray-400">{f.label}</dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-800">
                    {f.value}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </div>
  );
}
