import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { computeQuotePricing } from "@/lib/quotes";
import { quoteItemUpdateSchema } from "@/lib/validations";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await req.json();
  const parsed = quoteItemUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "数据校验失败", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServerClient();

  const { data: existing } = await supabase
    .from("quote_items")
    .select("*")
    .eq("id", params.id)
    .single();
  if (!existing) {
    return NextResponse.json({ error: "报价记录不存在" }, { status: 404 });
  }
  if (existing.sale_id) {
    return NextResponse.json(
      { error: "该报价已转为销售，不能再修改" },
      { status: 400 },
    );
  }

  const merged = { ...existing, ...parsed.data };
  const pricing = computeQuotePricing(merged);

  const { data, error } = await supabase
    .from("quote_items")
    .update({ ...parsed.data, ...pricing })
    .eq("id", params.id)
    .select("*, products(id, code, name, price, sale_status)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();

  const { data: existing } = await supabase
    .from("quote_items")
    .select("sale_id")
    .eq("id", params.id)
    .single();
  if (existing?.sale_id) {
    return NextResponse.json(
      { error: "该报价已转为销售，请先删除销售记录" },
      { status: 400 },
    );
  }

  const { error } = await supabase
    .from("quote_items")
    .delete()
    .eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
