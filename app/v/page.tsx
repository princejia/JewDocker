import type { Metadata } from "next";
import { BeianFooter } from "@/components/layout/BeianFooter";
import { createServerClient } from "@/lib/supabase-server";
import { formatProductCode } from "@/lib/utils";
import type { LooseStone, Product } from "@/types";
import { CFShowcaseClient, type ShowcaseItem } from "./CFShowcaseClient";

export const dynamic = "force-dynamic";

const SITE_TITLE = "C&F 珠宝展示";
const SITE_DESCRIPTION =
  "C&F 珠宝公开展示目录，产品与裸石实拍图，可按编号、名称或品类检索。";

// 展示全部目录（含已售），上限仅作为公开页面的兜底保护
const MAX_ITEMS_PER_TYPE = 500;

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is string => typeof item === "string" && item.length > 0
  );
}

export async function generateMetadata(): Promise<Metadata> {
  let cover: string | undefined;

  try {
    const supabase = createServerClient();
    const { data } = await supabase
      .from("products")
      .select("image_urls")
      .order("created_at", { ascending: false })
      .limit(8);

    cover = (data ?? [])
      .flatMap((row) =>
        toStringArray((row as { image_urls: unknown }).image_urls)
      )
      .find((url) => url.startsWith("http"));
  } catch {
    cover = undefined;
  }

  return {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    openGraph: {
      type: "website",
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      siteName: "C&F 珠宝",
      images: cover ? [{ url: cover, width: 1200, height: 1200 }] : undefined,
    },
    twitter: {
      card: cover ? "summary_large_image" : "summary",
      title: SITE_TITLE,
      description: SITE_DESCRIPTION,
      images: cover ? [cover] : undefined,
    },
  };
}

export default async function CFPublicShowcasePage() {
  const supabase = createServerClient();

  const [productRes, stoneRes] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, code, name, image_urls, gemstone_category, function_category, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(MAX_ITEMS_PER_TYPE),
    supabase
      .from("loose_stones")
      .select("id, code, material, image_urls, gemstone_category, created_at")
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
    | "id"
    | "code"
    | "name"
    | "image_urls"
    | "gemstone_category"
    | "function_category"
    | "created_at"
  >[];
  const stoneRows = (stoneRes.data ?? []) as Pick<
    LooseStone,
    | "id"
    | "code"
    | "material"
    | "image_urls"
    | "gemstone_category"
    | "created_at"
  >[];

  const products: ShowcaseItem[] = productRows.map((item) => ({
    id: item.id,
    type: "product",
    code: item.code ?? formatProductCode("P", item.created_at),
    name: item.name,
    category: item.gemstone_category || item.function_category || null,
    images: toStringArray(item.image_urls),
  }));

  const stones: ShowcaseItem[] = stoneRows.map((item) => ({
    id: item.id,
    type: "stone",
    code: item.code ?? formatProductCode("L", item.created_at),
    name: item.material || "未命名裸石",
    category: item.gemstone_category || item.material || null,
    images: toStringArray(item.image_urls),
  }));

  return (
    <>
      <CFShowcaseClient products={products} stones={stones} />
      <BeianFooter className="bg-zinc-50" />
    </>
  );
}
