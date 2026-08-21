import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { createServerClient } from "@/lib/supabase-server";
import { Product } from "@/types";
import { Gallery } from "@/app/v/[type]/[id]/Gallery";
import { BackButton } from "@/components/products/BackButton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { categoryLabel, isGoldCategory, purchaseCostOf } from "@/lib/constants";
import { formatCurrency, formatDate, formatProductCode } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Field = { label: string; value: string | null | undefined };

export default async function ProductViewPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!data) notFound();
  const product = data as Product;

  const isGold = isGoldCategory(product.gemstone_category);
  const laborSubtotal =
    Number(product.total_weight || 0) * Number(product.labor_cost || 0);
  const surchargeSubtotal =
    Number(product.surcharge || 0) * Number(product.purchase_discount || 0);
  const goldPriceCost =
    Number(product.total_weight || 0) * Number(product.purchase_price || 0);
  const purchaseCost = purchaseCostOf(product);

  const fields: Field[] = [
    {
      label: "重量",
      value:
        product.total_weight != null
          ? `${product.total_weight}${product.weight_unit || "g"}`
          : null,
    },
    { label: "尺寸", value: product.size },
    { label: "产地", value: product.origin },
    { label: "供应商", value: product.supplier },
    { label: "宝石分类", value: categoryLabel(product.gemstone_category) },
    { label: "功能分类", value: categoryLabel(product.function_category) },
    { label: "镶嵌配石", value: product.inlaid_stones },
    { label: "价格", value: formatCurrency(product.price) },
    { label: "进货价", value: formatCurrency(product.purchase_price) },
    { label: "出售价", value: formatCurrency(product.sale_price) },
    {
      label: "利润",
      value:
        product.sale_status === "sold"
          ? formatCurrency(Number(product.sale_price || 0) - purchaseCost)
          : null,
    },
    ...(isGold
      ? [
          {
            label: "工费销售价格 (g/元)",
            value:
              product.labor_sale_price != null
                ? formatCurrency(product.labor_sale_price)
                : null,
          },
          {
            label: "工费成本 (g/元)",
            value:
              product.labor_cost != null
                ? formatCurrency(product.labor_cost)
                : null,
          },
          {
            label: "附加费 (g/元)",
            value:
              product.surcharge != null
                ? formatCurrency(product.surcharge)
                : null,
          },
          {
            label: "买入折扣",
            value:
              product.purchase_discount != null
                ? String(product.purchase_discount)
                : null,
          },
          { label: "工费小计", value: formatCurrency(laborSubtotal) },
          { label: "附加费小计", value: formatCurrency(surchargeSubtotal) },
          { label: "进货金价成本", value: formatCurrency(goldPriceCost) },
          { label: "进货总成本", value: formatCurrency(purchaseCost) },
        ]
      : []),
    { label: "购入时间", value: formatDate(product.purchased_at) },
    { label: "出售时间", value: formatDate(product.sold_at) },
    { label: "备注", value: product.notes },
  ];

  const visible = fields.filter((f) => f.value);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <BackButton />

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
            <StatusBadge status={product.sale_status} />
          </div>
          <p className="mt-1 font-mono text-sm text-gray-400">
            编号：{product.code ?? formatProductCode("P", product.created_at)}
          </p>
        </div>
        <Link
          href={`/products/${product.id}`}
          className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          <Pencil className="h-4 w-4" />
          编辑
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white">
        <Gallery images={product.image_urls ?? []} title={product.name} />

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
