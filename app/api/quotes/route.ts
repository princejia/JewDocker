import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { ensureCustomerId } from "@/lib/customers";
import { quoteSchema } from "@/lib/validations";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("quotes")
    .select("*, quote_items(id, quoted_price, sale_id)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = quoteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "数据校验失败", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServerClient();
  const customerName = parsed.data.customer_name.trim();
  const customerId =
    parsed.data.customer_id ?? (await ensureCustomerId(customerName));

  const { data, error } = await supabase
    .from("quotes")
    .insert({
      customer_id: customerId,
      customer_name: customerName,
      notes: parsed.data.notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
