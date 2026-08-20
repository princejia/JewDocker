import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { saleSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const customer_id = searchParams.get("customer_id");

  const supabase = createServerClient();

  let query = supabase
    .from("product_sales")
    .select(
      "*, products(id, name, image_urls), customers(id, name), loose_stones(id, material, image_urls)"
    )
    .order("sold_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (from) query = query.gte("sold_at", from);
  if (to) query = query.lte("sold_at", to);
  if (customer_id) query = query.eq("customer_id", customer_id);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = saleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "数据校验失败", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  // 校验：借调中的物品不可出售 / 租售
  if (parsed.data.product_id) {
    const { data: activeLoan } = await supabase
      .from("item_loans")
      .select("id")
      .eq("product_id", parsed.data.product_id)
      .is("returned_at", null)
      .maybeSingle();
    if (activeLoan) {
      return NextResponse.json(
        { error: "该产品正在借调中，无法出售" },
        { status: 400 }
      );
    }
  } else if (parsed.data.loose_stone_id) {
    const { data: activeLoan } = await supabase
      .from("item_loans")
      .select("id")
      .eq("loose_stone_id", parsed.data.loose_stone_id)
      .is("returned_at", null)
      .maybeSingle();
    if (activeLoan) {
      return NextResponse.json(
        { error: "该裸石正在借调中，无法出售" },
        { status: 400 }
      );
    }
  }

  const soldAt = parsed.data.sold_at ?? new Date().toISOString().slice(0, 10);
  const saleStatus = parsed.data.sale_status;

  const { data, error } = await supabase
    .from("product_sales")
    .insert({
      product_id: parsed.data.product_id ?? null,
      loose_stone_id: parsed.data.loose_stone_id ?? null,
      customer_id: parsed.data.customer_id ?? null,
      sale_price: parsed.data.sale_price,
      payment_method: parsed.data.payment_method ?? null,
      sold_at: soldAt,
      notes: parsed.data.notes ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 创建销售记录后，同步更新对应产品或裸石的销售状态
  if (parsed.data.product_id) {
    await supabase
      .from("products")
      .update({
        sale_status: saleStatus,
        is_consignment: saleStatus === "consignment",
        sold_at: soldAt,
        sale_price: parsed.data.sale_price,
        settled_amount: saleStatus === "consignment" ? 0 : parsed.data.sale_price,
      })
      .eq("id", parsed.data.product_id);
  } else if (parsed.data.loose_stone_id) {
    await supabase
      .from("loose_stones")
      .update({
        sale_status: saleStatus,
        sold_at: soldAt,
        sale_price: parsed.data.sale_price,
      })
      .eq("id", parsed.data.loose_stone_id);
  }

  return NextResponse.json({ data }, { status: 201 });
}
