import { Product, LooseStone } from "@/types";
import { categoryLabel } from "@/lib/constants";
import { formatProductCode } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  in_stock: "在库",
  sold: "已售",
  consignment: "借售",
};

/**
 * COS 域名没有配置 CORS，跨域直取会让 canvas 污染 / 图片加载失败，
 * 统一改走同源代理。
 */
function sameOriginUrl(url: string) {
  return /^https?:\/\//i.test(url)
    ? `/api/image-proxy?url=${encodeURIComponent(url)}`
    : url;
}

/**
 * 将图片 URL 加载并转换为 PNG base64（去掉 data 前缀）。
 * 使用 canvas 归一化格式（兼容 jpeg/png/webp），失败时返回 null。
 */
function loadImageAsPngBase64(rawUrl: string): Promise<string | null> {
  const url = sameOriginUrl(rawUrl);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL("image/png");
        resolve(dataUrl.split(",")[1] ?? null);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** 触发工作簿下载 */
async function downloadWorkbook(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  workbook: any,
  filename: string,
) {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** 将产品列表导出为 Excel 文件（首图嵌入第一列）并触发下载 */
export async function exportProductsToExcel(
  products: Product[],
  filename?: string,
) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("产品清单");

  ws.columns = [
    { header: "图片", key: "image", width: 14 },
    { header: "编号", key: "code", width: 20 },
    { header: "产品名称", key: "name", width: 20 },
    { header: "销售状态", key: "status", width: 10 },
    { header: "价格(¥)", key: "price", width: 12 },
    { header: "进货价(¥)", key: "purchase_price", width: 12 },
    { header: "利润(¥)", key: "profit", width: 12 },
    { header: "结款(¥)", key: "settled", width: 12 },
    { header: "未结款(¥)", key: "unsettled", width: 12 },
    { header: "出售价(¥)", key: "sale_price", width: 12 },
    { header: "工费销售价格(g/元)", key: "labor_sale_price", width: 16 },
    { header: "工费成本(g/元)", key: "labor_cost", width: 14 },
    { header: "附加费(g/元)", key: "surcharge", width: 14 },
    { header: "买入折扣", key: "purchase_discount", width: 10 },
    { header: "重量", key: "total_weight", width: 12 },
    { header: "单位", key: "weight_unit", width: 10 },
    { header: "尺寸", key: "size", width: 12 },
    { header: "宝石分类", key: "gemstone", width: 12 },
    { header: "功能分类", key: "function", width: 12 },
    { header: "产地", key: "origin", width: 12 },
    { header: "镶嵌配石", key: "inlaid", width: 14 },
    { header: "裸石", key: "is_loose", width: 8 },
    { header: "借售", key: "is_consignment", width: 8 },
    { header: "购入时间", key: "purchased_at", width: 16 },
    { header: "出售时间", key: "sold_at", width: 16 },
    { header: "备注", key: "notes", width: 24 },
  ];

  // 并行加载所有首图
  const images = await Promise.all(
    products.map((p) =>
      p.image_urls?.[0]
        ? loadImageAsPngBase64(p.image_urls[0])
        : Promise.resolve(null),
    ),
  );

  products.forEach((p, i) => {
    const row = ws.addRow({
      code: p.code ?? formatProductCode("P", p.created_at),
      name: p.name,
      status: STATUS_LABEL[p.sale_status] ?? p.sale_status,
      price: Number(p.price),
      purchase_price: Number(p.purchase_price),
      profit: Number(p.profit),
      settled: Number(p.settled_amount),
      unsettled: Number(p.unsettled_amount),
      sale_price: Number(p.sale_price ?? 0),
      labor_sale_price: p.labor_sale_price ?? "",
      labor_cost: p.labor_cost ?? "",
      surcharge: p.surcharge ?? "",
      purchase_discount: p.purchase_discount ?? "",
      total_weight: p.total_weight ?? "",
      weight_unit: p.weight_unit ?? "",
      size: p.size ?? "",
      gemstone: categoryLabel(p.gemstone_category),
      function: categoryLabel(p.function_category),
      origin: p.origin ?? "",
      inlaid: p.inlaid_stones ?? "",
      is_loose: p.is_loose_stone ? "是" : "否",
      is_consignment: p.is_consignment ? "是" : "否",
      purchased_at: p.purchased_at ?? "",
      sold_at: p.sold_at ?? "",
      notes: p.notes ?? "",
    });

    const base64 = images[i];
    if (base64) {
      row.height = 70;
      const imageId = workbook.addImage({ base64, extension: "png" });
      ws.addImage(imageId, {
        tl: { col: 0, row: row.number - 1 },
        ext: { width: 90, height: 90 },
        editAs: "oneCell",
      });
    }
  });

  const name =
    filename ?? `产品清单_${new Date().toISOString().slice(0, 10)}.xlsx`;
  await downloadWorkbook(workbook, name);
}

/** 将裸石列表导出为 Excel 文件（首图嵌入第一列）并触发下载 */
export async function exportLooseStonesToExcel(
  stones: LooseStone[],
  filename?: string,
) {
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("裸石清单");

  ws.columns = [
    { header: "图片", key: "image", width: 14 },
    { header: "编号", key: "code", width: 20 },
    { header: "产品名称", key: "material", width: 20 },
    { header: "宝石分类", key: "gemstone", width: 12 },
    { header: "产地", key: "origin", width: 12 },
    { header: "证书", key: "certificate", width: 18 },
    { header: "尺寸", key: "size", width: 12 },
    { header: "重量", key: "weight", width: 12 },
    { header: "单位", key: "weight_unit", width: 10 },
    { header: "价格(¥)", key: "price", width: 12 },
    { header: "进货价(¥)", key: "purchase_price", width: 12 },
    { header: "售出价(¥)", key: "sale_price", width: 12 },
    { header: "购入时间", key: "purchased_at", width: 16 },
    { header: "卖出时间", key: "sold_at", width: 16 },
    { header: "备注", key: "notes", width: 24 },
    { header: "创建时间", key: "created_at", width: 16 },
  ];

  const images = await Promise.all(
    stones.map((s) =>
      s.image_urls?.[0]
        ? loadImageAsPngBase64(s.image_urls[0])
        : Promise.resolve(null),
    ),
  );

  stones.forEach((s, i) => {
    const row = ws.addRow({
      code: s.code ?? formatProductCode("L", s.created_at),
      material: s.material ?? "",
      gemstone: categoryLabel(s.gemstone_category),
      origin: s.origin ?? "",
      certificate: s.certificate ?? "",
      size: s.size ?? "",
      weight: s.weight ?? "",
      weight_unit: s.weight_unit ?? "",
      price: Number(s.price),
      purchase_price: Number(s.purchase_price ?? 0),
      sale_price: Number(s.sale_price ?? 0),
      purchased_at: s.purchased_at ?? "",
      sold_at: s.sold_at ?? "",
      notes: s.notes ?? "",
      created_at: s.created_at?.slice(0, 10) ?? "",
    });

    const base64 = images[i];
    if (base64) {
      row.height = 70;
      const imageId = workbook.addImage({ base64, extension: "png" });
      ws.addImage(imageId, {
        tl: { col: 0, row: row.number - 1 },
        ext: { width: 90, height: 90 },
        editAs: "oneCell",
      });
    }
  });

  const name =
    filename ?? `裸石清单_${new Date().toISOString().slice(0, 10)}.xlsx`;
  await downloadWorkbook(workbook, name);
}
