import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";

interface ItemRow {
  id: string;
  product_id: string | null;
  quoted_price: number;
  sale_id: string | null;
  quotes: { id: string; customer_id: string | null; customer_name: string } | null;
  products: { id: string; name: string; sale_status: string } | null;
}

/** 把一条报价明细落成销售记录：建/复用客户 → 写 product_sales → 回写产品状态与 sale_id */
export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();

  const { data: raw, error: loadError } = await supabase
    .from("quote_items")
    .select(
      "id, product_id, quoted_price, sale_id, quotes(id, customer_id, customer_name), products(id, name, sale_status)",
    )
    .eq("id", params.id)
    .single();

  if (loadError || !raw) {
    return NextResponse.json({ error: "报价记录不存在" }, { status: 404 });
  }

  const item = raw as unknown as ItemRow;

  if (item.sale_id) {
    return NextResponse.json({ error: "该报价已转为销售" }, { status: 400 });
  }
  if (!item.product_id || !item.products) {
    return NextResponse.json({ error: "产品已被删除，无法转销售" }, { status: 400 });
  }
  if (item.products.sale_status !== "in_stock") {
    return NextResponse.json(
      { error: "该产品已不在库，无法转销售" },
      { status: 400 },
    );
  }

  const { data: activeLoan } = await supabase
    .from("item_loans")
    .select("id")
    .eq("product_id", item.product_id)
    .is("returned_at", null)
    .maybeSingle();
  if (activeLoan) {
    return NextResponse.json(
      { error: "该产品正在借调中，无法出售" },
      { status: 400 },
    );
  }

  // 报价单只存客户名时，按同名客户复用，没有就建一个
  let customerId = item.quotes?.customer_id ?? null;
  const customerName = item.quotes?.customer_name?.trim();
  if (!customerId && customerName) {
    const { data: existing } = await supabase
      .from("customers")
      .select("id")
      .eq("name", customerName)
      .limit(1)
      .maybeSingle();
    if (existing) {
      customerId = existing.id;
    } else {
      const { data: created } = await supabase
        .from("customers")
        .insert({ name: customerName })
        .select("id")
        .single();
      customerId = created?.id ?? null;
    }
  }

  const soldAt = new Date().toISOString().slice(0, 10);
  const salePrice = Number(item.quoted_price || 0);

  const { data: sale, error: saleError } = await supabase
    .from("product_sales")
    .insert({
      product_id: item.product_id,
      customer_id: customerId,
      sale_price: salePrice,
      sold_at: soldAt,
      notes: "由报价转入",
    })
    .select()
    .single();

  if (saleError || !sale) {
    return NextResponse.json(
      { error: saleError?.message ?? "创建销售记录失败" },
      { status: 500 },
    );
  }

  await supabase
    .from("products")
    .update({
      sale_status: "sold",
      is_consignment: false,
      sold_at: soldAt,
      sale_price: salePrice,
      settled_amount: salePrice,
    })
    .eq("id", item.product_id);

  const { error: linkError } = await supabase
    .from("quote_items")
    .update({ sale_id: sale.id })
    .eq("id", item.id);

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }

  return NextResponse.json({ data: sale }, { status: 201 });
}
