import { createServerClient } from "@/lib/supabase-server";
import { Product } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/ui/StatsCard";
import { ProfitChart, ProfitDatum } from "@/components/reports/ProfitChart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { purchaseCostOf } from "@/lib/constants";
import { Coins, HelpCircle, Timer } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const supabase = createServerClient();
  const { data } = await supabase.from("products").select("*");
  const list: Product[] = data ?? [];

  // 库存成本
  const inStock = list.filter((p) => p.sale_status === "in_stock");
  const inventoryCost = inStock.reduce((s, p) => s + purchaseCostOf(p), 0);

  // 近 30 天销售趋势
  const days: ProfitDatum[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const sold = list.filter((p) => p.sold_at === d);
    days.push({
      date: d.slice(5),
      revenue: sold.reduce((s, p) => s + Number(p.sale_price || 0), 0),
      profit: sold.reduce(
        (s, p) => s + (Number(p.sale_price || 0) - purchaseCostOf(p)),
        0
      ),
    });
  }

  // 未结款汇总（仅借售，在库/已售不计入未结款）
  const unsettledList = list
    .filter(
      (p) => p.sale_status === "consignment" && Number(p.unsettled_amount) > 0
    )
    .sort((a, b) => Number(b.unsettled_amount) - Number(a.unsettled_amount));

  // 借售产品追踪
  const consignmentList = list.filter(
    (p) => p.sale_status === "consignment"
  );

  // 产品周转分析
  const SLOW_THRESHOLD = 90; // 滞销阈值（天）
  const dayMs = 86400000;

  const soldWithDates = list.filter(
    (p) => p.sale_status === "sold" && p.purchased_at && p.sold_at
  );
  const turnoverList = soldWithDates.map((p) => ({
    product: p,
    days: Math.max(
      0,
      Math.round(
        (new Date(p.sold_at as string).getTime() -
          new Date(p.purchased_at as string).getTime()) /
          dayMs
      )
    ),
  }));
  const avgTurnover = turnoverList.length
    ? Math.round(
        turnoverList.reduce((s, x) => s + x.days, 0) / turnoverList.length
      )
    : 0;

  // 快销 Top5（周转天数最短）
  const fastMoving = [...turnoverList]
    .sort((a, b) => a.days - b.days)
    .slice(0, 5);

  // 滞销：在库且持有超过阈值天数，按持有天数降序
  const now = Date.now();
  const slowMoving = inStock
    .filter((p) => p.purchased_at)
    .map((p) => ({
      product: p,
      days: Math.round(
        (now - new Date(p.purchased_at as string).getTime()) / dayMs
      ),
    }))
    .filter((x) => x.days >= SLOW_THRESHOLD)
    .sort((a, b) => b.days - a.days)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold text-gray-900">财务报表</h1>
        <span className="group relative inline-flex">
          <button
            type="button"
            aria-label="计算方式说明"
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
          <span className="pointer-events-none absolute left-0 top-full z-20 mt-1 w-[min(22rem,calc(100vw-2rem))] rounded-lg bg-gray-900 p-3 text-xs leading-relaxed text-white opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
            <span className="block font-semibold">在库总成本</span>
            <span className="block">· 黄金：进货总成本</span>
            <span className="block">· 其他：进货价</span>
            <span className="mt-2 block font-semibold">利润</span>
            <span className="block">· 黄金：出售价 − 进货总成本</span>
            <span className="block">· 其他：出售价 − 进货价</span>
            <span className="mt-2 block text-gray-300">
              进货总成本 = 进货价(g/元)×重量 + 工费成本(g/元)×重量 +
              附加费×买入折扣
            </span>
          </span>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          title="在库总成本"
          value={formatCurrency(inventoryCost)}
          icon={Coins}
          accent="gray"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">近 30 天销售趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfitChart data={days} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">未结款汇总</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>产品</TableHead>
                  <TableHead className="text-right">未结款</TableHead>
                  <TableHead>售出</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unsettledList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-gray-400">
                      无未结款
                    </TableCell>
                  </TableRow>
                ) : (
                  unsettledList.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right text-red-500">
                        {formatCurrency(p.unsettled_amount)}
                      </TableCell>
                      <TableCell>{formatDate(p.sold_at)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">借售产品追踪</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>产品</TableHead>
                  <TableHead className="text-right">价格</TableHead>
                  <TableHead>借出时间</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {consignmentList.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-gray-400">
                      无借售产品
                    </TableCell>
                  </TableRow>
                ) : (
                  consignmentList.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right text-amber-700">
                        {formatCurrency(p.price)}
                      </TableCell>
                      <TableCell>{formatDate(p.sold_at)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* 产品周转分析 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatsCard
          title="平均库存周转天数"
          value={`${avgTurnover} 天`}
          icon={Timer}
          accent="blue"
          hint={`基于 ${turnoverList.length} 件已售产品`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">快销产品 Top 5</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>产品</TableHead>
                  <TableHead className="text-right">周转天数</TableHead>
                  <TableHead className="text-right">利润</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fastMoving.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-gray-400">
                      暂无数据
                    </TableCell>
                  </TableRow>
                ) : (
                  fastMoving.map(({ product, days }) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        {product.name}
                      </TableCell>
                      <TableCell className="text-right text-green-700">
                        {days} 天
                      </TableCell>
                      <TableCell className="text-right text-green-700">
                        {formatCurrency(product.profit)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              滞销产品（在库超 90 天）
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>产品</TableHead>
                  <TableHead className="text-right">已持有</TableHead>
                  <TableHead className="text-right">价格</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {slowMoving.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-gray-400">
                      无滞销产品
                    </TableCell>
                  </TableRow>
                ) : (
                  slowMoving.map(({ product, days }) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">
                        {product.name}
                      </TableCell>
                      <TableCell className="text-right text-red-500">
                        {days} 天
                      </TableCell>
                      <TableCell className="text-right text-amber-700">
                        {formatCurrency(product.price)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
