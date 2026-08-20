import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { productSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const page = Math.max(1, Number(searchParams.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit") || 20)));
  const status = searchParams.get("status");
  const search = searchParams.get("search");
  const is_loose_stone = searchParams.get("is_loose_stone");
  const origin = searchParams.get("origin");
  const gemstone_category = searchParams.get("gemstone_category");
  const price_min = searchParams.get("price_min");
  const price_max = searchParams.get("price_max");
  const sort_by = searchParams.get("sort_by") || "created_at";
  const order = searchParams.get("order") || "desc";

  const allowedSort = ["price", "created_at", "purchased_at"];
  const sortColumn = allowedSort.includes(sort_by) ? sort_by : "created_at";

  const supabase = createServerClient();

  let query = supabase.from("products").select("*", { count: "exact" });

  if (status) query = query.eq("sale_status", status);
  if (search) {
    const safe = search.replace(/[,()*]/g, "");
    query = query.or(`name.ilike.%${safe}%,code.ilike.%${safe}%`);
  }
  if (is_loose_stone !== null)
    query = query.eq("is_loose_stone", is_loose_stone === "true");
  if (origin) query = query.eq("origin", origin);
  if (gemstone_category)
    query = query.eq("gemstone_category", gemstone_category);
  if (price_min) query = query.gte("price", Number(price_min));
  if (price_max) query = query.lte("price", Number(price_max));

  query = query
    .order(sortColumn, { ascending: order === "asc" })
    .range((page - 1) * limit, page * limit - 1);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 附加派生状态：是否存在未归还的借调记录
  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length > 0) {
    const ids = rows.map((r) => r.id as string);
    const { data: loans } = await supabase
      .from("item_loans")
      .select("product_id")
      .is("returned_at", null)
      .in("product_id", ids);
    const loanedSet = new Set((loans ?? []).map((l) => l.product_id));
    rows.forEach((r) => {
      r.is_loaned = loanedSet.has(r.id);
    });
  }

  return NextResponse.json({
    data: rows,
    total: count,
    page,
    limit,
    totalPages: Math.ceil((count || 0) / limit),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = productSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "数据校验失败", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("products")
    .insert(parsed.data)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data }, { status: 201 });
}
