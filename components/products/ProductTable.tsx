import Link from "next/link";
import { Product } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SelectionCheckbox } from "@/components/ui/SelectionCheckbox";
import { formatCurrency, formatDate, formatProductCode } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function ProductTable({
  products,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: {
  products: Product[];
  selectedIds?: Set<string>;
  onToggleSelect?: (product: Product) => void;
  onToggleSelectAll?: (products: Product[], checked: boolean) => void;
}) {
  const selectable = !!onToggleSelect;
  const allChecked =
    products.length > 0 && products.every((p) => selectedIds?.has(p.id));

  return (
    <div className="rounded-xl border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            {selectable && (
              <TableHead className="w-10">
                <SelectionCheckbox
                  checked={allChecked}
                  onToggle={() => onToggleSelectAll?.(products, !allChecked)}
                  label="全选本页"
                />
              </TableHead>
            )}
            <TableHead>编号</TableHead>
            <TableHead>产品名称</TableHead>
            <TableHead>状态</TableHead>
            <TableHead className="text-right">价格</TableHead>
            <TableHead className="text-right">未结款</TableHead>
            <TableHead className="text-right">利润</TableHead>
            <TableHead>产地</TableHead>
            <TableHead>购入时间</TableHead>
            <TableHead>出售时间</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={selectable ? 10 : 9}
                className="text-center text-gray-400"
              >
                暂无数据
              </TableCell>
            </TableRow>
          ) : (
            products.map((p) => (
              <TableRow
                key={p.id}
                className={`cursor-pointer ${
                  selectedIds?.has(p.id) ? "bg-amber-50" : ""
                }`}
              >
                {selectable && (
                  <TableCell>
                    <SelectionCheckbox
                      checked={!!selectedIds?.has(p.id)}
                      onToggle={() => onToggleSelect?.(p)}
                      label={`选择 ${p.name}`}
                    />
                  </TableCell>
                )}
                <TableCell className="font-mono text-xs">
                  <Link
                    href={`/products/${p.id}`}
                    className="text-gray-500 hover:text-amber-700"
                  >
                    {p.code ?? formatProductCode("P", p.created_at)}
                  </Link>
                </TableCell>
                <TableCell>
                  <Link
                    href={`/products/${p.id}`}
                    className="font-medium text-gray-900 hover:text-amber-700"
                  >
                    {p.name}
                    {p.is_loose_stone && (
                      <span className="ml-2 text-xs text-blue-600">裸石</span>
                    )}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <StatusBadge status={p.sale_status} />
                    {p.is_loaned && (
                      <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                        借调中
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium text-amber-700">
                  {formatCurrency(p.price)}
                </TableCell>
                <TableCell className="text-right">
                  {p.sale_status === "consignment" && p.unsettled_amount > 0 ? (
                    <span className="text-red-500">
                      {formatCurrency(p.unsettled_amount)}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
                <TableCell className="text-right text-green-700">
                  {formatCurrency(p.profit)}
                </TableCell>
                <TableCell className="text-gray-600">
                  {p.origin || "-"}
                </TableCell>
                <TableCell className="text-gray-600">
                  {formatDate(p.purchased_at)}
                </TableCell>
                <TableCell className="text-gray-600">
                  {p.sale_status !== "in_stock" ? formatDate(p.sold_at) : "-"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
