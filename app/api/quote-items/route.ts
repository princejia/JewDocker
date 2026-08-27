import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { computeQuotePricing } from "@/lib/quotes";
import { quoteItemSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = quoteItemSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "数据校验失败", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const pricing = computeQuotePricing(input);

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("quote_items")
    .insert({
      quote_id: input.quote_id,
      product_id: input.product_id,
      is_gold: input.is_gold,
      weight: input.weight ?? null,
      list_price: input.list_price,
      discount: input.discount,
      labor_price: input.labor_price ?? null,
      labor_discount: input.labor_discount ?? null,
      surcharge: input.surcharge ?? null,
      surcharge_discount: input.surcharge_discount ?? null,
      gold_price: input.gold_price ?? null,
      ...pricing,
    })
    .select("*, products(id, code, name, price, sale_status)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
