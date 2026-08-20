import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createServerClient } from "@/lib/supabase-server";
import { Product } from "@/types";
import { ProductForm } from "@/components/products/ProductForm";
import { DeleteProductButton } from "@/components/products/DeleteProductButton";
import { LabelPdfButton } from "@/components/products/LabelPdfButton";
import { productLabelItem } from "@/lib/labels";
import { formatProductCode } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({
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

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/products"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        返回产品列表
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">编辑产品</h1>
          <p className="mt-1 font-mono text-sm text-gray-400">
            编号：{product.code ?? formatProductCode("P", product.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LabelPdfButton item={productLabelItem(product)} />
          <DeleteProductButton id={product.id} />
        </div>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <ProductForm initial={product} />
      </div>
    </div>
  );
}
