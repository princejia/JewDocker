import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { processingSchema } from "@/lib/validations";

const SELECT =
  "*, products(id, code, name, image_urls, total_weight, weight_unit, size, inlaid_stones, gemstone_category, function_category), " +
  "loose_stones(id, code, material, image_urls, weight, weight_unit, size, gemstone_category), " +
  "customers(id, name)";

export async function GET(req: NextRequest) {
  const search = req.nextUrl.searchParams.get("search");

  const supabase = createServerClient();
  let query = supabase
    .from("processings")
    .select(SELECT)
    .order("ordered_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (search) {
    const safe = search.replace(/[,()*]/g, "");
    query = query.or(`code.ilike.%${safe}%,customer_name.ilike.%${safe}%`);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = processingSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "数据校验失败", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("processings")
    .insert(parsed.data)
    .select(SELECT)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data }, { status: 201 });
}
