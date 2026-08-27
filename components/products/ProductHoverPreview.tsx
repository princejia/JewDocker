"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { Product } from "@/types";
import { categoryLabel } from "@/lib/constants";

export type PreviewProduct = Pick<
  Product,
  | "name"
  | "image_urls"
  | "total_weight"
  | "weight_unit"
  | "size"
  | "inlaid_stones"
  | "gemstone_category"
  | "function_category"
>;

export interface HoverPreview {
  product: PreviewProduct;
  x: number;
  y: number;
}

const PREVIEW_WIDTH = 288;
const PREVIEW_HEIGHT = 180;

/** 跟随鼠标的产品详情卡片：挂到 body 上，避开下拉/弹窗的裁切与层叠限制 */
export function ProductHoverPreview({ product, x, y }: HoverPreview) {
  const rows: [string, string | null][] = [
    [
      "重量",
      product.total_weight != null
        ? `${product.total_weight} ${product.weight_unit || "克(g)"}`
        : null,
    ],
    ["尺寸", product.size],
    ["镶嵌配石", product.inlaid_stones],
    ["宝石分类", categoryLabel(product.gemstone_category) || null],
    ["功能分类", categoryLabel(product.function_category) || null],
  ];

  return createPortal(
    <div
      className="pointer-events-none fixed z-[100] hidden w-72 gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-xl md:flex"
      style={{
        left: Math.min(x + 16, window.innerWidth - PREVIEW_WIDTH - 8),
        top: Math.min(y, window.innerHeight - PREVIEW_HEIGHT - 8),
      }}
    >
      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-gray-50">
        {product.image_urls?.[0] ? (
          <Image
            src={product.image_urls[0]}
            alt={product.name}
            fill
            className="object-cover"
            sizes="80px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl text-gray-300">
            💎
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1 truncate text-sm font-semibold text-gray-900">
          {product.name}
        </p>
        <dl className="space-y-0.5 text-xs text-gray-600">
          {rows
            .filter(([, v]) => v)
            .map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <dt className="shrink-0 text-gray-400">{label}</dt>
                <dd className="truncate">{value}</dd>
              </div>
            ))}
        </dl>
      </div>
    </div>,
    document.body
  );
}
