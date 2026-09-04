import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/** 返回各分类字段已有的去重取值，用于表单自动补全建议 */
export async function GET() {
  const supabase = createServerClient();

  const [{ data: products }, { data: stones }, { data: sales }] =
    await Promise.all([
      supabase.from("products").select("gemstone_category, function_category"),
      supabase.from("loose_stones").select("gemstone_category, material"),
      supabase.from("product_sales").select("salesperson"),
    ]);

  const uniq = (arr: (string | null | undefined)[]) =>
    Array.from(new Set(arr.filter((v): v is string => !!v))).sort((a, b) =>
      a.localeCompare(b, "zh-CN")
    );

  const gemstone_category = uniq([
    ...(products ?? []).map((p) => p.gemstone_category),
    ...(stones ?? []).map((s) => s.gemstone_category),
  ]);
  const function_category = uniq(
    (products ?? []).map((p) => p.function_category)
  );
  const material = uniq((stones ?? []).map((s) => s.material));
  const salesperson = uniq((sales ?? []).map((s) => s.salesperson));

  return NextResponse.json({
    gemstone_category,
    function_category,
    material,
    salesperson,
  });
}
