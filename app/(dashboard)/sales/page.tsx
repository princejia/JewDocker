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
      "*, products(id, name, image_urls, sale_status), customers(id, name), loose_stones(id, material, image_urls, sale_status)"
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
    0
  );

  const grossRevenue = sales.reduce((s, r) => s + Number(r.sale_price || 0), 0);
  const totalRevenue = grossRevenue - totalRefund;
  const avgPrice = sales.length ? grossRevenue / sales.length : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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

      <div className="rounded-xl border bg-white">
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
                      s.loose_stones?.material ?? "已删除记录"
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
                    {(s.products?.sale_status ?? s.loose_stones?.sale_status) ===
                    "consignment" ? (
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
