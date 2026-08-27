import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
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

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("quote_items")
    .insert({
      quote_id: parsed.data.quote_id,
      product_id: parsed.data.product_id,
      list_price: parsed.data.list_price,
      discount: parsed.data.discount,
      quoted_price: parsed.data.quoted_price,
    })
    .select("*, products(id, code, name, price, sale_status)")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
