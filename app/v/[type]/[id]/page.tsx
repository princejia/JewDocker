import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase-server";
import { getCurrentSession } from "@/lib/users";
import { categoryLabel } from "@/lib/constants";
import { formatProductCode } from "@/lib/utils";
import { Product, LooseStone } from "@/types";
import { Gallery } from "./Gallery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "C&F珠宝展示",
  description: "C&F Jewelry item detail",
};

// 仅取展示所需列，避免把成本价 / 售价读进这个公开页面
const PRODUCT_COLUMNS =
  "id, code, name, image_urls, total_weight, weight_unit, size, origin, gemstone_category, function_category, inlaid_stones, created_at";
const STONE_COLUMNS =
  "id, code, material, image_urls, weight, weight_unit, size, origin, gemstone_category, certificate, created_at";

type Field = { label: string; value: string | null | undefined };

export default async function PublicViewPage({
  params,
}: {
  params: { type: string; id: string };
}) {
  const { type, id } = params;
  if (type !== "p" && type !== "s") notFound();

  // 已登录用户直接进入对应编辑页
  const session = await getCurrentSession();
  if (session) {
    redirect(type === "p" ? `/products/${id}` : `/loose-stones?edit=${id}`);
  }

  // 未登录：展示清新页面（不含价格）
  const supabase = createServerClient();
  const table = type === "p" ? "products" : "loose_stones";
  const columns = type === "p" ? PRODUCT_COLUMNS : STONE_COLUMNS;
  const { data } = await supabase
    .from(table)
    .select(columns)
    .eq("id", id)
    .single();
  if (!data) notFound();

  let title: string;
  let code: string;
  let images: string[];
  let fields: Field[];

  if (type === "p") {
    const p = data as unknown as Product;
    title = p.name;
    code = p.code ?? formatProductCode("P", p.created_at);
    images = p.image_urls ?? [];
    fields = [
      { label: "重量", value: p.total_weight != null ? `${p.total_weight}${p.weight_unit || "g"}` : null },
      { label: "尺寸", value: p.size },
      { label: "产地", value: p.origin },
      { label: "宝石分类", value: categoryLabel(p.gemstone_category) },
      { label: "功能分类", value: categoryLabel(p.function_category) },
      { label: "镶嵌配石", value: p.inlaid_stones },
    ];
  } else {
    const s = data as unknown as LooseStone;
    title = s.material || "未命名裸石";
    code = s.code ?? formatProductCode("L", s.created_at);
    images = s.image_urls ?? [];
    fields = [
      { label: "重量", value: s.weight != null ? `${s.weight}${s.weight_unit || "g"}` : null },
      { label: "尺寸", value: s.size },
      { label: "产地", value: s.origin },
      { label: "宝石分类", value: categoryLabel(s.gemstone_category) },
      { label: "证书", value: s.certificate },
    ];
  }

  const visible = fields.filter((f) => f.value);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-rose-50">
      <div className="mx-auto max-w-md px-4 py-10">
        <div className="overflow-hidden rounded-3xl border border-amber-100 bg-white shadow-xl shadow-amber-100/40">
          <Gallery images={images} title={title} />

          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            <p className="mt-1 font-mono text-xs tracking-wide text-amber-600">
              {code}
            </p>

            {visible.length > 0 && (
              <dl className="mt-6 grid grid-cols-2 gap-4">
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

        <p className="mt-6 text-center text-xs text-gray-400">
          扫码查看 · 仅展示商品信息
        </p>
      </div>
    </div>
  );
}
