import { createServerClient } from "@/lib/supabase-server";

/** 按名称找客户，找不到就自动建档，返回客户 id */
export async function ensureCustomerId(
  name: string | null | undefined,
): Promise<string | null> {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return null;

  const supabase = createServerClient();
  const { data: existing } = await supabase
    .from("customers")
    .select("id")
    .eq("name", trimmed)
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created } = await supabase
    .from("customers")
    .insert({ name: trimmed })
    .select("id")
    .single();
  return created?.id ?? null;
}
