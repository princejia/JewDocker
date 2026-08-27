import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase-server";
import { quoteSchema } from "@/lib/validations";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("quotes")
    .select(
      "*, quote_items(*, products(id, code, name, price, sale_status))",
    )
    .eq("id", params.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json({ data });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await req.json();
  const parsed = quoteSchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "数据校验失败", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("quotes")
    .update(parsed.data)
    .eq("id", params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { error } = await supabase.from("quotes").delete().eq("id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
