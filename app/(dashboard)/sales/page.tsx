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
import { formatCurrency, formatDate } from "@/lib/utils";
import { RecordSaleDialog } from "@/components/sales/RecordSaleDialog";
import { SaleRowActions } from "@/components/sales/SaleRowActions";
import { ReturnsManager } from "@/components/sales/ReturnsManager";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("product_sales")
    .select(
      "*, products(id, name, image_urls, sale_status), customers(id, name), loose_stones(id, material, image_urls, sale_status)",
    )
    .order("sold_at", { ascending: false })
    .order("created_at", { ascending: false });

  const sales = (data ?? []) as ProductSaleWithRelations[];

  const { data: returnsData } = await supabase
    .from("product_returns")
    .select("refund_amount");
  const returns = (returnsData ?? []) as Pick<ProductReturn, "refund_amount">[];
  const totalRefund = returns.reduce(
    (s, r) => s + Number(r.refund_amount || 0),
    0,
  );

  const grossRevenue = sales.reduce((s, r) => s + Number(r.sale_price || 0), 0);
  const totalRevenue = grossRevenue - totalRefund;
  const avgPrice = sales.length ? grossRevenue / sales.length : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">销售记录</h1>
        <RecordSaleDialog />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          title="总成交笔数"
          value={sales.length}
          icon={Receipt}
          accent="amber"
        />
        <StatsCard
          title="总销售额"
          value={formatCurrency(totalRevenue)}
          icon={TrendingUp}
          accent="green"
        />
        <StatsCard
          title="平均客单价"
          value={formatCurrency(avgPrice)}
          icon={Users}
          accent="blue"
        />
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
                    ) : (
                      <p className="truncate font-medium text-gray-900">
                        {s.loose_stones?.material ?? "已删除记录"}
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
                <TableCell colSpan={9} className="text-center text-gray-400">
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
                    ) : (
                      (s.loose_stones?.material ?? "已删除记录")
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

      <ReturnsManager />
    </div>
  );
}
