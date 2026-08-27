import { notFound } from "next/navigation";
import { createServerClient } from "@/lib/supabase-server";
import { QuoteWithItems } from "@/types";
import { QuoteEditor } from "@/components/quotes/QuoteEditor";

export const dynamic = "force-dynamic";

export default async function QuoteDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("quotes")
    .select("*, quote_items(*, products(id, code, name, price, sale_status))")
    .eq("id", params.id)
    .single();

  if (!data) notFound();

  return <QuoteEditor quote={data as unknown as QuoteWithItems} />;
}
