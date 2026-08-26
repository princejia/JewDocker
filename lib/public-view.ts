import { categoryLabel } from "@/lib/constants";
import { formatProductCode } from "@/lib/utils";
import type { LooseStone, Product } from "@/types";

// 公开展示页只读这两组列：售价 + 实体标签上已经印出来的规格，成本类字段一律不查
export const PUBLIC_PRODUCT_COLUMNS =
  "id, code, name, image_urls, price, total_weight, weight_unit, size, origin, gemstone_category, function_category, inlaid_stones, labor_sale_price, surcharge, created_at";
export const PUBLIC_STONE_COLUMNS =
  "id, code, material, image_urls, price, weight, weight_unit, size, origin, gemstone_category, certificate, created_at";

export interface PublicField {
  label: string;
  value: string;
}

export interface PublicItemView {
  title: string;
  code: string;
  images: string[];
  price: number;
  fields: PublicField[];
}

export function toImageArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && item.length > 0,
  );
}

const compact = (
  fields: { label: string; value: string | null | undefined }[],
): PublicField[] =>
  fields.filter((f): f is PublicField => Boolean(f.value));

export function productPublicView(p: Product): PublicItemView {
  return {
    title: p.name,
    code: p.code ?? formatProductCode("P", p.created_at),
    images: toImageArray(p.image_urls),
    price: Number(p.price || 0),
    fields: compact([
      {
        label: "重量",
        value:
          p.total_weight != null
            ? `${p.total_weight}${p.weight_unit || "g"}`
            : null,
      },
      { label: "尺寸", value: p.size },
      { label: "产地", value: p.origin },
      { label: "宝石分类", value: categoryLabel(p.gemstone_category) },
      { label: "功能分类", value: categoryLabel(p.function_category) },
      { label: "镶嵌配石", value: p.inlaid_stones },
      {
        label: "工费",
        value: p.labor_sale_price ? `¥${p.labor_sale_price}/g` : null,
      },
      { label: "附加费", value: p.surcharge ? `¥${p.surcharge}/g` : null },
    ]),
  };
}

export function stonePublicView(s: LooseStone): PublicItemView {
  return {
    title: s.material || "未命名裸石",
    code: s.code ?? formatProductCode("L", s.created_at),
    images: toImageArray(s.image_urls),
    price: Number(s.price || 0),
    fields: compact([
      {
        label: "重量",
        value: s.weight != null ? `${s.weight}${s.weight_unit || "g"}` : null,
      },
      { label: "尺寸", value: s.size },
      { label: "产地", value: s.origin },
      { label: "宝石分类", value: categoryLabel(s.gemstone_category) },
      { label: "证书", value: s.certificate },
    ]),
  };
}
