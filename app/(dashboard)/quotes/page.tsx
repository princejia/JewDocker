import Link from "next/link";
import { createServerClient } from "@/lib/supabase-server";
import { Customer, Quote } from "@/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { NewQuoteDialog } from "@/components/quotes/NewQuoteDialog";
import { DeleteQuoteButton } from "@/components/quotes/DeleteQuoteButton";

export const dynamic = "force-dynamic";

type QuoteRow = Quote & {
  quote_items: { id: string; quoted_price: number; sale_id: string | null }[];
};

export default async function QuotesPage() {
  const supabase = createServerClient();

  const [{ data }, { data: customerData }] = await Promise.all([
    supabase
      .from("quotes")
      .select("*, quote_items(id, quoted_price, sale_id)")
      .order("created_at", { ascending: false }),
    supabase.from("customers").select("name").order("name"),
  ]);

  const quotes = (data ?? []) as QuoteRow[];
  const customerNames = ((customerData ?? []) as Pick<Customer, "name">[]).map(
    (c) => c.name,
  );

  const summarize = (q: QuoteRow) => {
    const items = q.quote_items ?? [];
    return {
      count: items.length,
      total: items.reduce((s, i) => s + Number(i.quoted_price || 0), 0),
      converted: items.filter((i) => i.sale_id).length,
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">报价管理</h1>
        <NewQuoteDialog customerNames={customerNames} />
      </div>

      <div className="space-y-3 md:hidden">
        {quotes.length === 0 ? (
          <p className="rounded-xl border bg-white py-10 text-center text-sm text-gray-400">
            暂无报价
          </p>
        ) : (
          quotes.map((q) => {
            const s = summarize(q);
            return (
              <div key={q.id} className="rounded-xl border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <Link href={`/quotes/${q.id}`} className="min-w-0 flex-1">
                    <p className="truncate font-medium text-amber-700">
                      {q.customer_name}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {formatDateTime(q.created_at)} · {s.count} 件
                    </p>
                  </Link>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="font-semibold text-amber-700">
                      {formatCurrency(s.total)}
                    </span>
                    <DeleteQuoteButton
                      quoteId={q.id}
                      customerName={q.customer_name}
                      convertedCount={s.converted}
                    />
                  </div>
                </div>
                {s.converted > 0 && (
                  <p className="mt-2 text-xs text-green-700">
                    已转销售 {s.converted} 件
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>

      <div className="hidden rounded-xl border bg-white md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>客户</TableHead>
              <TableHead className="text-right">报价件数</TableHead>
              <TableHead className="text-right">合计金额</TableHead>
              <TableHead className="text-right">已转销售</TableHead>
              <TableHead>报价时间</TableHead>
              <TableHead>备注</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-400">
                  暂无报价
                </TableCell>
              </TableRow>
            ) : (
              quotes.map((q) => {
                const s = summarize(q);
                return (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/quotes/${q.id}`}
                        className="text-amber-700 hover:underline"
                      >
                        {q.customer_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">{s.count}</TableCell>
                    <TableCell className="text-right font-medium text-amber-700">
                      {formatCurrency(s.total)}
                    </TableCell>
                    <TableCell className="text-right text-green-700">
                      {s.converted || "-"}
                    </TableCell>
                    <TableCell>{formatDateTime(q.created_at)}</TableCell>
                    <TableCell
                      className="max-w-[240px] truncate text-gray-600"
                      title={q.notes ?? undefined}
                    >
                      {q.notes || "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end">
                        <DeleteQuoteButton
                          quoteId={q.id}
                          customerName={q.customer_name}
                          convertedCount={s.converted}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
