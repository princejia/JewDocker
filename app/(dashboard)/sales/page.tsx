import Link from "next/link";
import { createServerClient } from "@/lib/supabase-server";
import { ProductSaleWithRelations, ProductReturn } from "@/types";
import { StatsCard } from "@/components/ui/StatsCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Receipt, TrendingUp, Users } from "lucide-react";
import { formatCurrency, formatDate, nextMonthStart } from "@/lib/utils";
import { CollapsibleRows } from "@/components/ui/CollapsibleRows";
import { RecordSaleDialog } from "@/components/sales/RecordSaleDialog";
import { SaleRowActions } from "@/components/sales/SaleRowActions";
import { ReturnsManager } from "@/components/sales/ReturnsManager";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const UNASSIGNED = "__none__";

export default async function SalesPage({
  searchParams,
}: {
  searchParams?: { page?: string; month?: string; salesperson?: string };
}) {
  const supabase = createServerClient();

  const month = /^\d{4}-\d{2}$/.test(searchParams?.month ?? "")
    ? (searchParams?.month as string)
    : "";
  const salesperson = searchParams?.salesperson?.trim() || "";
  const monthFrom = month ? `${month}-01` : "";
  const monthTo = month ? nextMonthStart(month) : "";

  // 筛选下拉的可选项取自全量数据，不随当前筛选变化
  const { data: facetData } = await supabase
    .from("product_sales")
    .select("sold_at, salesperson");
  const facets = (facetData ?? []) as {
    sold_at: string | null;
    salesperson: string | null;
  }[];
  const monthOptions = [
    ...new Set(facets.map((f) => (f.sold_at ?? "").slice(0, 7)).filter(Boolean)),
  ].sort((a, b) => b.localeCompare(a));
  const salespersonOptions = [
    ...new Set(facets.map((f) => f.salesperson).filter((v): v is string => !!v)),
  ].sort((a, b) => a.localeCompare(b, "zh-CN"));

  // 统计与按月汇总需要全量数据，不能只算当前页；总数也复用它，省一次 count 查询
  let allSalesQuery = supabase
    .from("product_sales")
    .select("sale_price, sold_at, salesperson");
  if (month)
    allSalesQuery = allSalesQuery.gte("sold_at", monthFrom).lt("sold_at", monthTo);
  if (salesperson)
    allSalesQuery =
      salesperson === UNASSIGNED
        ? allSalesQuery.is("salesperson", null)
        : allSalesQuery.eq("salesperson", salesperson);
  const { data: allSalesData } = await allSalesQuery;
  const allSales = (allSalesData ?? []) as {
    sale_price: number;
    sold_at: string;
    salesperson: string | null;
  }[];

  const total = allSales.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(
    totalPages,
    Math.max(1, Number(searchParams?.page || 1) || 1),
  );

  let listQuery = supabase
    .from("product_sales")
    .select(
      "*, products(id, code, name, image_urls, sale_status), customers(id, name), loose_stones(id, code, material, image_urls, sale_status)",
    )
    .order("sold_at", { ascending: false })
    .order("created_at", { ascending: false });
  if (month)
    listQuery = listQuery.gte("sold_at", monthFrom).lt("sold_at", monthTo);
  if (salesperson)
    listQuery =
      salesperson === UNASSIGNED
        ? listQuery.is("salesperson", null)
        : listQuery.eq("salesperson", salesperson);
  const { data } = await listQuery.range(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE - 1,
  );

  const sales = (data ?? []) as ProductSaleWithRelations[];

  // 报价来源单独查：报价表未迁移时这里失败也不影响流水列表本身
  if (sales.length) {
    const { data: links } = await supabase
      .from("quote_items")
      .select("id, code, quote_id, sale_id")
      .in(
        "sale_id",
        sales.map((s) => s.id),
      );
    const bySale = new Map(
      ((links ?? []) as {
        id: string;
        code: string | null;
        quote_id: string;
        sale_id: string;
      }[]).map((l) => [l.sale_id, l]),
    );
    for (const s of sales) {
      const link = bySale.get(s.id);
      s.quote_items = link
        ? { id: link.id, code: link.code, quote_id: link.quote_id }
        : null;
    }
  }

  // 退货没有销售员归属，按销售员筛选时不参与统计
  const refundApplies = !salesperson;
  let returnsQuery = supabase
    .from("product_returns")
    .select("refund_amount, returned_at");
  if (month)
    returnsQuery = returnsQuery
      .gte("returned_at", monthFrom)
      .lt("returned_at", monthTo);
  const { data: returnsData } = refundApplies
    ? await returnsQuery
    : { data: [] };
  const returns = (returnsData ?? []) as Pick<
    ProductReturn,
    "refund_amount" | "returned_at"
  >[];
  const totalRefund = returns.reduce(
    (s, r) => s + Number(r.refund_amount || 0),
    0,
  );

  const grossRevenue = allSales.reduce(
    (s, r) => s + Number(r.sale_price || 0),
    0,
  );
  const totalRevenue = grossRevenue - totalRefund;
  const avgPrice = allSales.length ? grossRevenue / allSales.length : 0;

  // 按月统计：销售按成交日期归属，退款按退货日期归属
  const monthly = new Map<
    string,
    { month: string; count: number; gross: number; refund: number }
  >();
  const bucket = (date: string | null | undefined) => {
    const month = (date ?? "").slice(0, 7);
    if (!month) return null;
    let row = monthly.get(month);
    if (!row) {
      row = { month, count: 0, gross: 0, refund: 0 };
      monthly.set(month, row);
    }
    return row;
  };
  for (const s of allSales) {
    const row = bucket(s.sold_at);
    if (!row) continue;
    row.count += 1;
    row.gross += Number(s.sale_price || 0);
  }
  for (const r of returns) {
    const row = bucket(r.returned_at);
    if (!row) continue;
    row.refund += Number(r.refund_amount || 0);
  }
  const monthlyRows = [...monthly.values()].sort((a, b) =>
    b.month.localeCompare(a.month),
  );

  // 按销售员汇总：退货无销售员归属，这里只统计成交额
  const byPerson = new Map<string, { name: string; count: number; gross: number }>();
  for (const s of allSales) {
    const name = s.salesperson || "未指定";
    let row = byPerson.get(name);
    if (!row) {
      row = { name, count: 0, gross: 0 };
      byPerson.set(name, row);
    }
    row.count += 1;
    row.gross += Number(s.sale_price || 0);
  }
  const personRows = [...byPerson.values()].sort((a, b) => b.gross - a.gross);

  const filtered = !!(month || salesperson);
  const pageHref = (p: number) => {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (salesperson) params.set("salesperson", salesperson);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/sales?${qs}` : "/sales";
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">销售记录</h1>
        <RecordSaleDialog />
      </div>

      <form
        action="/sales"
        className="flex flex-wrap items-end gap-3 rounded-xl border bg-white p-4"
      >
        <div className="space-y-1">
          <label htmlFor="filter-month" className="block text-xs text-gray-500">
            月份
          </label>
          <select
            id="filter-month"
            name="month"
            defaultValue={month}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">全部月份</option>
            {monthOptions.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label
            htmlFor="filter-salesperson"
            className="block text-xs text-gray-500"
          >
            销售员
          </label>
          <select
            id="filter-salesperson"
            name="salesperson"
            defaultValue={salesperson}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">全部销售员</option>
            {salespersonOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
            <option value={UNASSIGNED}>未指定</option>
          </select>
        </div>
        <button
          type="submit"
          className="h-10 rounded-md bg-amber-600 px-4 text-sm font-medium text-white hover:bg-amber-700"
        >
          查询
        </button>
        {filtered && (
          <Link
            href="/sales"
            className="flex h-10 items-center rounded-md border px-4 text-sm text-gray-700 hover:bg-gray-50"
          >
            重置
          </Link>
        )}
      </form>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          title={filtered ? "筛选成交笔数" : "总成交笔数"}
          value={total}
          icon={Receipt}
          accent="amber"
        />
        <StatsCard
          title={filtered ? "筛选销售额" : "总销售额"}
          value={formatCurrency(totalRevenue)}
          icon={TrendingUp}
          accent="green"
          hint={
            refundApplies
              ? filtered
                ? "当前筛选口径，已扣除退款"
                : "全部历史累计，已扣除退款"
              : "退货无销售员归属，未扣除退款"
          }
        />
        <StatsCard
          title="平均客单价"
          value={formatCurrency(avgPrice)}
          icon={Users}
          accent="blue"
        />
      </div>

      <div className="rounded-xl border bg-white">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">按销售员统计</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>销售员</TableHead>
              <TableHead className="text-right">成交笔数</TableHead>
              <TableHead className="text-right">销售额</TableHead>
              <TableHead className="text-right">平均客单价</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {personRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-gray-400">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              personRows.map((p) => (
                <TableRow key={p.name}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right">{p.count}</TableCell>
                  <TableCell className="text-right font-medium text-amber-700">
                    {formatCurrency(p.gross)}
                  </TableCell>
                  <TableCell className="text-right">
                    {p.count ? formatCurrency(p.gross / p.count) : "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-xl border bg-white">
        <div className="border-b px-4 py-3">
          <h2 className="text-base font-semibold text-gray-900">按月统计</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>月份</TableHead>
              <TableHead className="text-right">成交笔数</TableHead>
              <TableHead className="text-right">销售额</TableHead>
              <TableHead className="text-right">退款</TableHead>
              <TableHead className="text-right">净销售额</TableHead>
              <TableHead className="text-right">平均客单价</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monthlyRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-400">
                  暂无数据
                </TableCell>
              </TableRow>
            ) : (
              <CollapsibleRows colSpan={6}>
                {monthlyRows.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell className="font-medium">{m.month}</TableCell>
                    <TableCell className="text-right">{m.count}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(m.gross)}
                    </TableCell>
                    <TableCell className="text-right text-red-500">
                      {m.refund ? `-${formatCurrency(m.refund)}` : "-"}
                    </TableCell>
                    <TableCell className="text-right font-medium text-amber-700">
                      {formatCurrency(m.gross - m.refund)}
                    </TableCell>
                    <TableCell className="text-right">
                      {m.count ? formatCurrency(m.gross / m.count) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </CollapsibleRows>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3 md:hidden">
        {sales.length === 0 ? (
          <p className="rounded-xl border bg-white py-10 text-center text-sm text-gray-400">
            暂无销售记录
          </p>
        ) : (
          sales.map((s) => {
            const consigned =
              (s.products?.sale_status ?? s.loose_stones?.sale_status) ===
              "consignment";
            return (
              <div key={s.id} className="rounded-xl border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {s.products ? (
                      <Link
                        href={`/products/${s.products.id}/view`}
                        className="block truncate font-medium text-amber-700"
                      >
                        {s.products.name}
                      </Link>
                    ) : s.loose_stones ? (
                      <Link
                        href={`/loose-stones/${s.loose_stones.id}/view`}
                        className="block truncate font-medium text-amber-700"
                      >
                        {s.loose_stones.material ?? "裸石"}
                      </Link>
                    ) : (
                      <p className="truncate font-medium text-gray-900">
                        已删除记录
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-gray-500">
                      {formatDate(s.sold_at)} ·{" "}
                      {s.customers?.name ?? "未指定客户"}
                    </p>
                  </div>
                  <span className="shrink-0 font-semibold text-amber-700">
                    {formatCurrency(s.sale_price)}
                  </span>
                </div>

                <div className="mt-2.5 flex flex-wrap gap-1.5 text-xs">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                    {s.loose_stones ? "裸石" : "产品"}
                  </span>
                  <span
                    className={
                      consigned
                        ? "rounded-full bg-purple-50 px-2 py-0.5 text-purple-700"
                        : "rounded-full bg-green-50 px-2 py-0.5 text-green-700"
                    }
                  >
                    {consigned ? "借售" : "出售"}
                  </span>
                  {s.payment_method && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                      {s.payment_method}
                    </span>
                  )}
                  {s.salesperson && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                      销售员 {s.salesperson}
                    </span>
                  )}
                  {s.quote_items?.code && (
                    <Link
                      href={`/quotes/${s.quote_items.quote_id}?item=${s.quote_items.id}`}
                      className="rounded-full bg-amber-50 px-2 py-0.5 font-mono text-amber-700"
                    >
                      {s.quote_items.code}
                    </Link>
                  )}
                </div>

                {s.notes && (
                  <p className="mt-2 break-words text-xs text-gray-500">
                    {s.notes}
                  </p>
                )}

                <div className="mt-3 border-t pt-2">
                  <SaleRowActions sale={s} />
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="hidden rounded-xl border bg-white md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>物品</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>销售方式</TableHead>
              <TableHead>客户</TableHead>
              <TableHead>销售员</TableHead>
              <TableHead>报价编号</TableHead>
              <TableHead className="text-right">成交价</TableHead>
              <TableHead>付款方式</TableHead>
              <TableHead>成交时间</TableHead>
              <TableHead>备注</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-gray-400">
                  暂无销售记录
                </TableCell>
              </TableRow>
            ) : (
              sales.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">
                    {s.products ? (
                      <Link
                        href={`/products/${s.products.id}/view`}
                        className="text-amber-700 hover:underline"
                      >
                        {s.products.name}
                      </Link>
                    ) : s.loose_stones ? (
                      <Link
                        href={`/loose-stones/${s.loose_stones.id}/view`}
                        className="text-amber-700 hover:underline"
                      >
                        {s.loose_stones.material ?? "裸石"}
                      </Link>
                    ) : (
                      "已删除记录"
                    )}
                  </TableCell>
                  <TableCell>
                    {s.loose_stones ? (
                      <span className="text-blue-600">裸石</span>
                    ) : (
                      "产品"
                    )}
                  </TableCell>
                  <TableCell>
                    {(s.products?.sale_status ??
                      s.loose_stones?.sale_status) === "consignment" ? (
                      <span className="text-purple-600">借售</span>
                    ) : (
                      <span className="text-green-600">出售</span>
                    )}
                  </TableCell>
                  <TableCell>{s.customers?.name ?? "-"}</TableCell>
                  <TableCell>{s.salesperson || "-"}</TableCell>
                  <TableCell>
                    {s.quote_items?.code ? (
                      <Link
                        href={`/quotes/${s.quote_items.quote_id}?item=${s.quote_items.id}`}
                        className="font-mono text-xs text-amber-700 hover:underline"
                      >
                        {s.quote_items.code}
                      </Link>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium text-amber-700">
                    {formatCurrency(s.sale_price)}
                  </TableCell>
                  <TableCell>{s.payment_method || "-"}</TableCell>
                  <TableCell>{formatDate(s.sold_at)}</TableCell>
                  <TableCell
                    className="max-w-[200px] truncate text-gray-600"
                    title={s.notes ?? undefined}
                  >
                    {s.notes || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <SaleRowActions sale={s} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 text-sm">
          <span className="text-gray-500">
            共 {total} 条 · 第 {page} / {totalPages} 页
          </span>
          <div className="flex items-center gap-2">
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className="rounded-lg border px-3 py-1.5 text-gray-700 hover:bg-gray-50"
              >
                上一页
              </Link>
            ) : (
              <span className="rounded-lg border px-3 py-1.5 text-gray-300">
                上一页
              </span>
            )}
            {page < totalPages ? (
              <Link
                href={pageHref(page + 1)}
                className="rounded-lg border px-3 py-1.5 text-gray-700 hover:bg-gray-50"
              >
                下一页
              </Link>
            ) : (
              <span className="rounded-lg border px-3 py-1.5 text-gray-300">
                下一页
              </span>
            )}
          </div>
        </div>
      )}

      <ReturnsManager />
    </div>
  );
}
