import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase-server";
import { getCurrentSession } from "@/lib/users";
import {
  PUBLIC_PRODUCT_COLUMNS,
  PUBLIC_STONE_COLUMNS,
  productPublicView,
  stonePublicView,
} from "@/lib/public-view";
import { Product, LooseStone } from "@/types";
import { Gallery } from "./Gallery";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "C&F珠宝展示",
  description: "C&F Jewelry item detail",
};

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

  // 未登录：展示清新页面（口径与实体标签一致）
  const supabase = createServerClient();
  const table = type === "p" ? "products" : "loose_stones";
  const columns = type === "p" ? PUBLIC_PRODUCT_COLUMNS : PUBLIC_STONE_COLUMNS;
  const { data } = await supabase
    .from(table)
    .select(columns)
    .eq("id", id)
    .single();
  if (!data) notFound();

  const { title, code, images, price, fields } =
    type === "p"
      ? productPublicView(data as unknown as Product)
      : stonePublicView(data as unknown as LooseStone);

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

            {price > 0 && (
              <p className="mt-4 text-3xl font-bold text-amber-600">
                ¥{price.toLocaleString()}
              </p>
            )}

            {fields.length > 0 && (
              <dl className="mt-6 grid grid-cols-2 gap-4">
                {fields.map((f) => (
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
