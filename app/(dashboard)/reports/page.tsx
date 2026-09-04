import { createServerClient } from "@/lib/supabase-server";
import { LooseStone, Product, ProductReturn, ProfitRow } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatsCard } from "@/components/ui/StatsCard";
import { ProfitChart, ProfitDatum } from "@/components/reports/ProfitChart";
import { ProfitDetailTable } from "@/components/reports/ProfitDetailTable";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate, formatProductCode } from "@/lib/utils";
import { CollapsibleRows } from "@/components/ui/CollapsibleRows";
import { purchaseCostOf, goldProfitParts } from "@/lib/constants";
import { Coins, HelpCircle, Timer } from "lucide-react";

export const dynamic = "force-dynamic";

interface SaleWithItem {
  id: string;
  sale_price: number;
  sold_at: string;
  products: Product | null;
  loose_stones: LooseStone | null;
}

export default async function ReportsPage() {
  const supabase = createServerClient();
  const { data } = await supabase.from("products").select("*");
  const list: Product[] = data ?? [];

  // 销售额/利润以 product_sales 流水为准（products 表只保留最后一次成交）
  // 借售（关联物品当前为 consignment）尚未收款，不计入
  const { data: salesData } = await supabase
    .from("product_sales")
    .select("id, sale_price, sold_at, products(*), loose_stones(*)")
    .order("sold_at", { ascending: false })
    .order("created_at", { ascending: false });

  const sales = ((salesData ?? []) as unknown as SaleWithItem[]).filter(
    (s) =>
      (s.products?.sale_status ?? s.loose_stones?.sale_status) !== "consignment"
  );

  const saleCost = (s: SaleWithItem) =>
    s.products
      ? purchaseCostOf(s.products)
      : Number(s.loose_stones?.purchase_price || 0);

  // 退货：按退货日期同时抵减销售额与利润（与仪表盘、销售页口径一致）
  const { data: returnsData } = await supabase
    .from("product_returns")
    .select("refund_amount, returned_at");
  const returns = (returnsData ?? []) as Pick<
    ProductReturn,
    "refund_amount" | "returned_at"
  >[];
  const refundByDay = new Map<string, number>();
  for (const r of returns) {
    const d = r.returned_at ?? "";
    if (!d) continue;
    refundByDay.set(d, (refundByDay.get(d) ?? 0) + Number(r.refund_amount || 0));
  }

  // 库存成本
  const inStock = list.filter((p) => p.sale_status === "in_stock");
  const inventoryCost = inStock.reduce((s, p) => s + purchaseCostOf(p), 0);

  // 近 30 天销售趋势
  const days: ProfitDatum[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const daySales = sales.filter((s) => s.sold_at === d);
    const dayRefund = refundByDay.get(d) ?? 0;
    days.push({
      date: d.slice(5),
      revenue:
        daySales.reduce((sum, s) => sum + Number(s.sale_price || 0), 0) -
        dayRefund,
      profit:
        daySales.reduce(
          (sum, s) => sum + (Number(s.sale_price || 0) - saleCost(s)),
          0
        ) - dayRefund,
    });
  }

  // 全部成交流水的利润明细
  // 黄金拆解的销售侧工费/附加费优先用报价快照（含折扣）
  const { data: quoteLinks } = await supabase
    .from("quote_items")
    .select("sale_id, labor_subtotal, surcharge_subtotal")
    .not("sale_id", "is", null);
  const quoteBySale = new Map(
    ((quoteLinks ?? []) as {
      sale_id: string;
      labor_subtotal: number | null;
      surcharge_subtotal: number | null;
    }[]).map((q) => [q.sale_id, q])
  );

  const profitRows: ProfitRow[] = sales.map((s) => {
    const cost = saleCost(s);
    const salePrice = Number(s.sale_price || 0);
    const item = s.products ?? s.loose_stones;
    const gold = s.products
      ? goldProfitParts(s.products, salePrice, quoteBySale.get(s.id))
      : null;
    return {
      id: s.id,
      code:
        item?.code ?? formatProductCode(s.products ? "P" : "L", item?.created_at),
      name: s.products?.name ?? s.loose_stones?.material ?? "已删除物品",
      sold_at: s.sold_at,
      sale_price: salePrice,
      cost,
      profit: salePrice - cost,
      is_gold: !!gold,
      labor_profit: gold?.laborProfit ?? null,
      surcharge_profit: gold?.surchargeProfit ?? null,
      gold_profit: gold?.goldProfit ?? null,
    };
  });

  // 按月汇总（销售按成交日期归属，退款按退货日期归属）
  const monthly = new Map<
    string,
    {
      month: string;
      count: number;
      revenue: number;
      cost: number;
      refund: number;
    }
  >();
  const monthBucket = (date: string | null | undefined) => {
    const month = (date ?? "").slice(0, 7);
    if (!month) return null;
    let row = monthly.get(month);
    if (!row) {
      row = { month, count: 0, revenue: 0, cost: 0, refund: 0 };
      monthly.set(month, row);
    }
    return row;
  };
  for (const r of profitRows) {
    const row = monthBucket(r.sold_at);
    if (!row) continue;
    row.count += 1;
    row.revenue += r.sale_price;
    row.cost += r.cost;
  }
  for (const r of returns) {
    const row = monthBucket(r.returned_at);
    if (!row) continue;
    row.refund += Number(r.refund_amount || 0);
  }
  const monthlyRows = [...monthly.values()].sort((a, b) =>
    b.month.localeCompare(a.month)
  );

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">按月汇总</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>月份</TableHead>
                <TableHead className="text-right">成交笔数</TableHead>
                <TableHead className="text-right">销售额</TableHead>
                <TableHead className="text-right">退款</TableHead>
                <TableHead className="text-right">净销售额</TableHead>
                <TableHead className="text-right">成本</TableHead>
                <TableHead className="text-right">利润</TableHead>
                <TableHead className="text-right">利润率</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-gray-400">
                    暂无数据
                  </TableCell>
                </TableRow>
              ) : (
                <CollapsibleRows colSpan={8}>
                  {monthlyRows.map((m) => {
                    const net = m.revenue - m.refund;
                    const profit = m.revenue - m.cost - m.refund;
                    return (
                      <TableRow key={m.month}>
                        <TableCell className="font-medium">{m.month}</TableCell>
                        <TableCell className="text-right">{m.count}</TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(m.revenue)}
                        </TableCell>
                        <TableCell className="text-right text-red-500">
                          {m.refund ? `-${formatCurrency(m.refund)}` : "-"}
                        </TableCell>
                        <TableCell className="text-right text-amber-700">
                          {formatCurrency(net)}
                        </TableCell>
                        <TableCell className="text-right text-gray-600">
                          {formatCurrency(m.cost)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            profit >= 0 ? "text-green-700" : "text-red-500"
                          }`}
                        >
                          {formatCurrency(profit)}
                        </TableCell>
                        <TableCell className="text-right text-gray-600">
                          {net ? `${((profit / net) * 100).toFixed(1)}%` : "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </CollapsibleRows>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">已售产品利润明细</CardTitle>
          <p className="mt-1 text-xs text-gray-400">
            黄金另按三段拆解：工费利润 = 销售工费小计 − 工费成本×克重；附加费利润
            = 销售附加费小计 − 附加费×买入折扣；金价利润 = (成交价 − 前两项) −
            进货价×克重。三项之和等于该行利润，非黄金分类不拆解。
          </p>
        </CardHeader>
        <CardContent>
          <ProfitDetailTable rows={profitRows} />
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
                        {formatCurrency(
                          Number(product.sale_price || 0) -
                            purchaseCostOf(product)
                        )}
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
                  <TableHead className="text-right">进货成本</TableHead>
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
                        {formatCurrency(purchaseCostOf(product))}
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
