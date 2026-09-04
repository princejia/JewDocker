import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { z } from "zod";

const saleUpdateSchema = z.object({
  customer_id: z.string().uuid().nullable().optional(),
  sale_price: z.coerce.number().nonnegative().optional(),
  payment_method: z.string().max(50).nullable().optional(),
  salesperson: z.string().max(100).nullable().optional(),
  sold_at: z.string().optional(),
  notes: z.string().max(2000).nullable().optional(),
  sale_status: z.enum(["sold", "consignment"]).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json();
  const parsed = saleUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "数据校验失败", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createServerClient();

  const { data: sale, error: fetchErr } = await supabase
    .from("product_sales")
    .select("id, product_id, loose_stone_id")
    .eq("id", params.id)
    .single();
  if (fetchErr || !sale) {
    return NextResponse.json({ error: "销售记录不存在" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("product_sales")
    .update({
      customer_id: parsed.data.customer_id,
      sale_price: parsed.data.sale_price,
      payment_method: parsed.data.payment_method,
      salesperson: parsed.data.salesperson,
      sold_at: parsed.data.sold_at,
      notes: parsed.data.notes,
    })
    .eq("id", params.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 同步对应物品的销售状态、成交价与时间
  if (sale.product_id) {
    await supabase
      .from("products")
      .update({
        sale_status: parsed.data.sale_status ?? undefined,
        is_consignment: parsed.data.sale_status
          ? parsed.data.sale_status === "consignment"
          : undefined,
        sold_at: parsed.data.sold_at ?? undefined,
        sale_price: parsed.data.sale_price ?? undefined,
        settled_amount:
          parsed.data.sale_status === "consignment"
            ? 0
            : parsed.data.sale_price ?? undefined,
      })
      .eq("id", sale.product_id);
  } else if (sale.loose_stone_id) {
    await supabase
      .from("loose_stones")
      .update({
        sale_status: parsed.data.sale_status ?? undefined,
        sold_at: parsed.data.sold_at ?? undefined,
        sale_price: parsed.data.sale_price ?? undefined,
      })
      .eq("id", sale.loose_stone_id);
  }

  return NextResponse.json({ data });
}

export async function DELETE(
  _: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerClient();

  const { data: sale } = await supabase
    .from("product_sales")
    .select("id, product_id, loose_stone_id")
    .eq("id", params.id)
    .single();

  const { error } = await supabase
    .from("product_sales")
    .delete()
    .eq("id", params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 删除销售记录后，物品恢复在库
  if (sale?.product_id) {
    await supabase
      .from("products")
      .update({
        sale_status: "in_stock",
        is_consignment: false,
        sold_at: null,
        sale_price: 0,
        settled_amount: 0,
      })
      .eq("id", sale.product_id);
  } else if (sale?.loose_stone_id) {
    await supabase
      .from("loose_stones")
      .update({ sale_status: "in_stock", sold_at: null, sale_price: 0 })
      .eq("id", sale.loose_stone_id);
  }

  return NextResponse.json({ success: true });
}
