import QRCode from "qrcode";
import { jsPDF } from "jspdf";

export interface LabelItem {
  id: string;
  code: string;
  name: string;
  type: "product" | "stone";
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

// 单个标签尺寸（mm）
const LABEL_W = 48;
const LABEL_H = 30;
const MARGIN = 8;
const GAP = 4;
const PX_PER_MM = 8; // 画布渲染精度（mm → px）

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** 折行文本，超出宽度自动换行（中文逐字判断）。 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const lines: string[] = [];
  let line = "";
  for (const ch of text) {
    if (ctx.measureText(line + ch).width > maxWidth && line) {
      lines.push(line);
      line = ch;
      if (lines.length >= maxLines - 1) break;
    } else {
      line += ch;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

/**
 * 将单个标签渲染到 canvas（使用浏览器字体，支持中文，避免 PDF 内置字体乱码）。
 * 返回 PNG DataURL，再整体嵌入 PDF。
 */
async function renderLabelImage(qrDataUrl: string, code: string, name: string): Promise<string> {
  const w = LABEL_W * PX_PER_MM;
  const h = LABEL_H * PX_PER_MM;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);

  // 二维码
  const qrSize = 20 * PX_PER_MM;
  const qrImg = await loadImage(qrDataUrl);
  ctx.drawImage(qrImg, 3 * PX_PER_MM, (h - qrSize) / 2, qrSize, qrSize);

  // 文本
  const textX = (3 + 20 + 3) * PX_PER_MM;
  const textW = w - textX - 3 * PX_PER_MM;
  ctx.textBaseline = "top";
  ctx.fillStyle = "#5a5a5a";
  ctx.font = "600 14px 'Microsoft YaHei', sans-serif";
  ctx.fillText(code, textX, 7 * PX_PER_MM, textW);
  ctx.fillStyle = "#111";
  ctx.font = "700 14px 'Microsoft YaHei', sans-serif";
  const nameLines = wrapText(ctx, name, textW, 3);
  nameLines.forEach((ln, i) => ctx.fillText(ln, textX, (12 + i * 5) * PX_PER_MM));

  return canvas.toDataURL("image/png");
}

/**
 * 为给定的产品/裸石生成标签 PDF 并下载保存。
 * 每个标签包含：二维码（编码展示页链接）、编号、名称，按 A4 网格排版，
 * 标签带虚线边框作为裁剪参考线。中文文本通过 canvas 渲染，避免乱码。
 */
export async function saveLabelsPdf(items: LabelItem[]): Promise<void> {
  if (items.length === 0) return;

  const origin = window.location.origin;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const cols = Math.max(1, Math.floor((pageW - 2 * MARGIN + GAP) / (LABEL_W + GAP)));
  const rows = Math.max(1, Math.floor((pageH - 2 * MARGIN + GAP) / (LABEL_H + GAP)));
  const perPage = cols * rows;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const idx = i % perPage;
    if (i > 0 && idx === 0) doc.addPage();

    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = MARGIN + col * (LABEL_W + GAP);
    const y = MARGIN + row * (LABEL_H + GAP);

    // 虚线裁剪边框
    doc.setDrawColor(160);
    doc.setLineDashPattern([1, 1], 0);
    doc.roundedRect(x, y, LABEL_W, LABEL_H, 1, 1);
    doc.setLineDashPattern([], 0);

    // 二维码 + 文本整体渲染为图片（中文不乱码）
    const qr = await QRCode.toDataURL(buildQrPayload(item, origin), {
      margin: 0,
      width: 240,
      errorCorrectionLevel: "M",
    });
    const labelImg = await renderLabelImage(qr, item.code, item.name);
    doc.addImage(labelImg, "PNG", x, y, LABEL_W, LABEL_H);
  }

  doc.save(`labels-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** 旧入口保留兼容：现统一改为保存 PDF。 */
export async function printLabels(items: LabelItem[]): Promise<void> {
  return saveLabelsPdf(items);
}
