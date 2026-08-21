import QRCode from "qrcode";
import { jsPDF } from "jspdf";
import { LooseStone, Product } from "@/types";

export interface LabelItem {
  id: string;
  code: string;
  name: string;
  type: "product" | "stone";
  /** 售价，为空或 0 时不打印 */
  price?: number | null;
  size?: string | null;
  origin?: string | null;
  weight?: number | null;
  weightUnit?: string | null;
  inlaidStones?: string | null;
  /** 工费销售价格（g/元） */
  laborPrice?: number | null;
  surcharge?: number | null;
}

export function productLabelItem(p: Product): LabelItem {
  return {
    id: p.id,
    code: p.code ?? "",
    name: p.name,
    type: "product",
    price: p.price,
    size: p.size,
    origin: p.origin,
    weight: p.total_weight,
    weightUnit: p.weight_unit,
    inlaidStones: p.inlaid_stones,
    laborPrice: p.labor_sale_price,
    surcharge: p.surcharge,
  };
}

export function stoneLabelItem(s: LooseStone): LabelItem {
  return {
    id: s.id,
    code: s.code ?? "",
    name: s.material || "未命名",
    type: "stone",
    price: s.price,
    size: s.size,
    origin: s.origin,
    weight: s.weight,
    weightUnit: s.weight_unit,
  };
}

/**
 * 生成二维码内容：指向公开展示页 /v/<p|s>/<id>。
 * - 未登录（手机相机直扫）：进入清新展示页（不含价格）。
 * - 已登录：自动跳转到对应编辑页。
 */
function buildQrPayload(item: LabelItem, origin: string): string {
  const t = item.type === "product" ? "p" : "s";
  return `${origin}/v/${t}/${encodeURIComponent(item.id)}`;
}

// 单张标签尺寸（mm）：Godex G530 走纸时 25mm 边先出，故打印宽度 25、走纸长度 30
// 折痕是 y=15mm 的横线，把标签分成上下两个 25×15mm 的可见面，内容不得跨越折痕
const LABEL_W = 25;
const LABEL_H = 30;
const FOLD_Y = LABEL_H / 2;
const FACE_W = LABEL_W;
const FACE_H = FOLD_Y;
// 热敏打印机最外圈约 1mm 印不出来，内容不排到这个范围里
const SAFE_EDGE = 1.2;
// 上面：二维码靠外沿放，售价在其右侧
const QR_SIZE = 11;
// 下面文字区；折痕附近容易压不实，内容额外往下让一段
const FOLD_GAP = 2.2;
const TEXT_W = FACE_W - SAFE_EDGE * 2;
const NAME_LINE_H = 2.4;
const FIELD_LINE_H = 1.84;
// G530 为 300dpi（≈11.8 点/mm），画布按 12px/mm 渲染后略微缩小，边缘更锐利
const PX_PER_MM = 12;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** 单行截断，超出宽度补省略号。 */
function truncate(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = "";
  for (const ch of text) {
    if (ctx.measureText(out + ch + "…").width > maxWidth) break;
    out += ch;
  }
  return out + "…";
}

/** 折行文本（中文逐字判断），超出行数时末行补省略号。 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  const chars = [...text];
  let line = "";
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (line && ctx.measureText(line + ch).width > maxWidth) {
      lines.push(line);
      line = "";
      if (lines.length >= maxLines - 1) {
        lines.push(truncate(ctx, chars.slice(i).join(""), maxWidth));
        return lines;
      }
    }
    line += ch;
  }
  if (line) lines.push(line);
  return lines;
}

const num = (v: number) =>
  Number.isInteger(v) ? String(v) : String(Number(v.toFixed(3)));

/** 右半面字段行，只打印值本身；值为空或 0 的字段整行省略。 */
function fieldValues(item: LabelItem): { text: string; wrap?: boolean }[] {
  const fields: { text: string; wrap?: boolean }[] = [];
  const push = (value: string | null | undefined, wrap?: boolean) => {
    if (value) fields.push({ text: value, wrap });
  };

  push(item.size);
  push(item.origin);
  if (item.weight) {
    push(`克重：${num(Number(item.weight))}${item.weightUnit || ""}`);
  }
  push(item.inlaidStones, true);

  const fee = [
    item.laborPrice ? `工费：${num(Number(item.laborPrice))}` : "",
    item.surcharge ? `F：${num(Number(item.surcharge))}` : "",
  ]
    .filter(Boolean)
    .join("  ");
  push(fee);

  return fields;
}

/**
 * 将单张标签渲染到 canvas（使用浏览器字体，支持中文，避免 PDF 内置字体乱码）。
 * 上面：二维码 + 售价；下面：产品名称与规格字段。返回 PNG DataURL。
 */
async function renderLabelImage(
  qrDataUrl: string,
  item: LabelItem,
): Promise<string> {
  const w = LABEL_W * PX_PER_MM;
  const h = LABEL_H * PX_PER_MM;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);

  ctx.textBaseline = "top";
  ctx.fillStyle = "#000";

  /** 把绘制原点切到指定面的左上角，局部坐标为 25mm(x) × 15mm(y) */
  const inFace = (face: 0 | 1, draw: () => void) => {
    ctx.save();
    ctx.translate(0, face * FOLD_Y * PX_PER_MM);
    draw();
    ctx.restore();
  };

  const qrImg = await loadImage(qrDataUrl);
  inFace(0, () => {
    ctx.drawImage(
      qrImg,
      SAFE_EDGE * PX_PER_MM,
      SAFE_EDGE * PX_PER_MM,
      QR_SIZE * PX_PER_MM,
      QR_SIZE * PX_PER_MM,
    );

    const price = Number(item.price || 0);
    if (price > 0) {
      ctx.textAlign = "left";
      ctx.font = "700 24px 'Microsoft YaHei', sans-serif";
      const priceX = SAFE_EDGE + QR_SIZE + 1.2;
      ctx.fillText(
        truncate(
          ctx,
          `¥${price.toLocaleString()}`,
          (FACE_W - priceX - SAFE_EDGE) * PX_PER_MM,
        ),
        priceX * PX_PER_MM,
        SAFE_EDGE * PX_PER_MM,
      );
    }
  });

  inFace(1, () => {
    const textX = SAFE_EDGE * PX_PER_MM;
    const textW = TEXT_W * PX_PER_MM;
    ctx.textAlign = "left";

    let y = FOLD_GAP;
    ctx.font = "700 22px 'Microsoft YaHei', sans-serif";
    wrapText(ctx, item.name, textW, 2).forEach((ln) => {
      ctx.fillText(ln, textX, y * PX_PER_MM);
      y += NAME_LINE_H;
    });

    y += 0.1;
    ctx.font = "600 18px 'Microsoft YaHei', sans-serif";
    for (const field of fieldValues(item)) {
      const lines = field.wrap
        ? wrapText(ctx, field.text, textW, 2)
        : [truncate(ctx, field.text, textW)];
      for (const line of lines) {
        if (y + FIELD_LINE_H > FACE_H - SAFE_EDGE) return;
        ctx.fillText(line, textX, y * PX_PER_MM);
        y += FIELD_LINE_H;
      }
    }
  });

  return canvas.toDataURL("image/png");
}

/**
 * 生成标签 PDF 并下载：每张标签独占一页，页面尺寸即标签尺寸，
 * 打印时选 Godex 驱动、缩放设为「实际大小 / 100%」即可直接出纸。
 */
export async function saveLabelsPdf(items: LabelItem[]): Promise<void> {
  if (items.length === 0) return;

  const origin = window.location.origin;
  const format: [number, number] = [LABEL_W, LABEL_H];
  const doc = new jsPDF({ unit: "mm", format, orientation: "portrait" });

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (i > 0) doc.addPage(format, "portrait");

    const qr = await QRCode.toDataURL(buildQrPayload(item, origin), {
      // 静区交给标签上的 1mm 白边，此处不再额外留，以保证模块尽量大
      margin: 0,
      width: 480,
      errorCorrectionLevel: "M",
    });
    const labelImg = await renderLabelImage(qr, item);
    doc.addImage(labelImg, "PNG", 0, 0, LABEL_W, LABEL_H);
  }

  doc.save(`labels-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** 旧入口保留兼容：现统一改为保存 PDF。 */
export async function printLabels(items: LabelItem[]): Promise<void> {
  return saveLabelsPdf(items);
}
