import type { Metadata } from "next";
import { Cormorant_Garamond, Montserrat } from "next/font/google";
import { createServerClient } from "@/lib/supabase-server";
import { formatProductCode } from "@/lib/utils";
import type { LooseStone, Product } from "@/types";
import {
  CFShowcaseClient,
  type ShowcaseItem,
} from "./CFShowcaseClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "C&F珠宝展示",
  description: "C&F Jewelry public showcase",
};

const headingFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["600", "700"],
});

const bodyFont = Montserrat({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

// 展示全部目录（含已售），上限仅作为公开页面的兵不死保护
const MAX_ITEMS_PER_TYPE = 500;

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
}

export default async function CFPublicShowcasePage() {
  const supabase = createServerClient();

  const [productRes, stoneRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, code, name, image_urls, created_at")
      .order("created_at", { ascending: false })
      .limit(MAX_ITEMS_PER_TYPE),
    supabase
      .from("loose_stones")
      .select("id, code, material, image_urls, created_at")
      .order("created_at", { ascending: false })
      .limit(MAX_ITEMS_PER_TYPE),
  ]);

  if (productRes.error || stoneRes.error) {
    throw new Error(
      productRes.error?.message ?? stoneRes.error?.message ?? "展示数据加载失败"
    );
  }

  const productRows = (productRes.data ?? []) as Pick<
    Product,
    "id" | "code" | "name" | "image_urls" | "created_at"
  >[];
  const stoneRows = (stoneRes.data ?? []) as Pick<
    LooseStone,
    "id" | "code" | "material" | "image_urls" | "created_at"
  >[];

  const products: ShowcaseItem[] = productRows.map((item) => ({
    id: item.id,
    type: "product",
    code: item.code ?? formatProductCode("P", item.created_at),
    name: item.name,
    images: toStringArray(item.image_urls),
  }));

  const stones: ShowcaseItem[] = stoneRows.map((item) => ({
    id: item.id,
    type: "stone",
    code: item.code ?? formatProductCode("L", item.created_at),
    name: item.material || "未命名裸石",
    images: toStringArray(item.image_urls),
  }));

  return (
    <CFShowcaseClient
      products={products}
      stones={stones}
      headingClassName={headingFont.className}
      bodyClassName={bodyFont.className}
    />
  );
}
