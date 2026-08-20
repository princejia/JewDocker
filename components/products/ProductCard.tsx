import Image from "next/image";
import Link from "next/link";
import { Product } from "@/types";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SelectionCheckbox } from "@/components/ui/SelectionCheckbox";
import { formatCurrency, formatDate, formatProductCode } from "@/lib/utils";

export function ProductCard({
  product,
  selected,
  onToggleSelect,
}: {
  product: Product;
  selected?: boolean;
  onToggleSelect?: (product: Product) => void;
}) {
  return (
    <Link href={`/products/${product.id}`}>
      <div
        className={`overflow-hidden rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
          selected
            ? "border-amber-500 ring-2 ring-amber-400"
            : "border-gray-100"
        }`}
      >
        {/* 产品图片 */}
        <div className="relative aspect-square bg-gray-50">
          {onToggleSelect && (
            <SelectionCheckbox
              checked={!!selected}
              onToggle={() => onToggleSelect(product)}
              label={`选择 ${product.name}`}
              className="absolute left-2 top-2 z-10 shadow-sm"
            />
          )}
          {product.image_urls?.[0] ? (
            <Image
              src={product.image_urls[0]}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 50vw, 25vw"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-4xl text-gray-300">
              💎
            </div>
          )}
        </div>
        {/* 产品信息 */}
        <div className="p-4">
          <p className="mb-1 font-mono text-[11px] text-gray-400">
            {product.code ?? formatProductCode("P", product.created_at)}
          </p>
          <div className="flex items-start justify-between gap-2">
            <h3 className="line-clamp-2 text-sm font-medium text-gray-900">
              {product.name}
            </h3>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <StatusBadge status={product.sale_status} />
              {product.is_loaned && (
                <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                  借调中
                </span>
              )}
            </div>
          </div>
          <p className="mt-1 text-lg font-bold text-amber-700">
            {formatCurrency(product.price)}
          </p>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
            {product.total_weight != null && (
              <span>
                {product.total_weight}
                {product.weight_unit || "g"}
              </span>
            )}
            {product.size && <span>{product.size}</span>}
            {product.origin && <span>{product.origin}</span>}
            {product.is_loose_stone && (
              <span className="text-blue-600">裸石</span>
            )}
          </div>
          {product.sale_status === "consignment" &&
            product.unsettled_amount > 0 && (
              <p className="mt-1 text-xs text-red-500">
                未结款：{formatCurrency(product.unsettled_amount)}
              </p>
            )}
          {product.sale_status !== "in_stock" && product.sold_at && (
            <p className="mt-1 text-xs text-gray-400">
              出售时间：{formatDate(product.sold_at)}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
