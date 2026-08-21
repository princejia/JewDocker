import {
  Package,
  TrendingUp,
  Wallet,
  AlertCircle,
  HandCoins,
} from "lucide-react";
import { createServerClient } from "@/lib/supabase-server";
import { StatsCard } from "@/components/ui/StatsCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StatusPieChart } from "@/components/reports/StatusPieChart";
import { formatCurrency, formatDate } from "@/lib/utils";
import { purchaseCostOf } from "@/lib/constants";
import { LooseStone, Product } from "@/types";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface MonthSale {
  sale_price: number;
  sold_at: string;
  products: Product | null;
  loose_stones: LooseStone | null;
}

function monthStart(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export default async function DashboardPage() {
  const supabase = createServerClient();

  const { data: products } = await supabase.from("products").select("*");
  const list: Product[] = products ?? [];

  const inStock = list.filter((p) => p.sale_status === "in_stock").length;
  const consignment = list.filter(
    (p) => p.sale_status === "consignment"
  ).length;
  const sold = list.filter((p) => p.sale_status === "sold").length;
  const unsettledTotal = list
    .filter((p) => p.sale_status === "consignment")
    .reduce((sum, p) => sum + Number(p.unsettled_amount || 0), 0);

  const statusData = [
    { key: "in_stock", name: "在库", value: inStock },
    { key: "sold", name: "已售", value: sold },
    { key: "consignment", name: "借售", value: consignment },
  ];

  const ms = monthStart();

  // 本月销售额/利润以 product_sales 流水为准（products 表只保留最后一次成交）
  // 借售（关联物品当前为 consignment）尚未收款，不计入销售额
  const { data: salesData } = await supabase
    .from("product_sales")
    .select("sale_price, sold_at, products(*), loose_stones(*)")
    .gte("sold_at", ms);

  const monthSales = (salesData ?? []) as unknown as MonthSale[];
  const settledSales = monthSales.filter(
    (s) =>
      (s.products?.sale_status ?? s.loose_stones?.sale_status) !== "consignment"
  );
  const monthRevenueGross = settledSales.reduce(
    (sum, s) => sum + Number(s.sale_price || 0),
    0
  );
  const monthProfitGross = settledSales.reduce((sum, s) => {
    const cost = s.products
      ? purchaseCostOf(s.products)
      : Number(s.loose_stones?.purchase_price || 0);
    return sum + Number(s.sale_price || 0) - cost;
  }, 0);

  // 本月退货：抵减销售额与利润，保持与销售记录同步
  const { data: returnsData } = await supabase
    .from("product_returns")
    .select("refund_amount, returned_at")
    .gte("returned_at", ms);
  const monthRefund = (returnsData ?? []).reduce(
    (s, r) => s + Number(r.refund_amount || 0),
    0
  );
  const monthRevenue = monthRevenueGross - monthRefund;
  const monthProfit = monthProfitGross - monthRefund;

  // 未结款超 7 天的产品
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000)
    .toISOString()
    .slice(0, 10);
  const overdueUnsettled = list
    .filter(
      (p) =>
        p.sale_status === "consignment" &&
        Number(p.unsettled_amount) > 0 &&
        p.sold_at &&
        p.sold_at <= sevenDaysAgo
    )
    .slice(0, 5);

  // 借售超 30 天的产品
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000)
    .toISOString()
    .slice(0, 10);
  const overdueConsignment = list
    .filter(
      (p) =>
        p.sale_status === "consignment" &&
        p.sold_at &&
        p.sold_at <= thirtyDaysAgo
    )
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">仪表盘</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          title="在库产品"
          value={inStock}
          icon={Package}
          accent="green"
        />
        <StatsCard
          title="未结款总额"
          value={formatCurrency(unsettledTotal)}
          icon={AlertCircle}
          accent="red"
        />
        <StatsCard
          title="借售中"
          value={consignment}
          icon={HandCoins}
          accent="gray"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <StatsCard
          title="本月销售额"
          value={formatCurrency(monthRevenue)}
          icon={TrendingUp}
          accent="amber"
        />
        <StatsCard
          title="本月利润"
          value={formatCurrency(monthProfit)}
          icon={Wallet}
          accent="blue"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">产品状态分布</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusPieChart data={statusData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">未结款超 7 天</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdueUnsettled.length === 0 ? (
              <p className="text-sm text-gray-400">暂无待办</p>
            ) : (
              overdueUnsettled.map((p) => (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-gray-400">
                      售出 {formatDate(p.sold_at)}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-red-500">
                    {formatCurrency(p.unsettled_amount)}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">借售超 30 天未归还</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overdueConsignment.length === 0 ? (
              <p className="text-sm text-gray-400">暂无待办</p>
            ) : (
              overdueConsignment.map((p) => (
                <Link
                  key={p.id}
                  href={`/products/${p.id}`}
                  className="flex items-center justify-between rounded-lg border p-3 hover:bg-gray-50"
                >
                  <div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-gray-400">
                      借出 {formatDate(p.sold_at)}
                    </p>
                  </div>
                  <StatusBadge status={p.sale_status} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
