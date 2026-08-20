"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";

export interface ProfitRow {
  id: string;
  code: string;
  name: string;
  sold_at: string | null;
  sale_price: number;
  cost: number;
  profit: number;
}

export function ProfitDetailTable({ rows }: { rows: ProfitRow[] }) {
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? rows.filter(
        (r) =>
          r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
      )
    : rows;

  const totalProfit = filtered.reduce((s, r) => s + r.profit, 0);
  const totalRevenue = filtered.reduce((s, r) => s + r.sale_price, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索编号或产品名称"
          className="sm:max-w-xs"
        />
        <div className="flex gap-4 text-sm">
          <span className="text-gray-500">
            共 <strong className="text-gray-900">{filtered.length}</strong> 件
          </span>
          <span className="text-gray-500">
            出售价合计{" "}
            <strong className="text-amber-700">
              {formatCurrency(totalRevenue)}
            </strong>
          </span>
          <span className="text-gray-500">
            利润合计{" "}
            <strong className={totalProfit >= 0 ? "text-green-700" : "text-red-500"}>
              {formatCurrency(totalProfit)}
            </strong>
          </span>
        </div>
      </div>

      <div className="max-h-96 overflow-y-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>编号</TableHead>
              <TableHead>产品</TableHead>
              <TableHead>出售时间</TableHead>
              <TableHead className="text-right">出售价</TableHead>
              <TableHead className="text-right">进货成本</TableHead>
              <TableHead className="text-right">利润</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-gray-400">
                  {rows.length === 0 ? "暂无已售产品" : "无匹配项"}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs text-gray-500">
                    {r.code}
                  </TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-gray-600">
                    {formatDate(r.sold_at)}
                  </TableCell>
                  <TableCell className="text-right text-amber-700">
                    {formatCurrency(r.sale_price)}
                  </TableCell>
                  <TableCell className="text-right text-gray-600">
                    {formatCurrency(r.cost)}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      r.profit >= 0 ? "text-green-700" : "text-red-500"
                    }`}
                  >
                    {formatCurrency(r.profit)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
