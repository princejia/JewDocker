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

// 单张标签尺寸（mm），对应 Godex G530 使用的 30×25mm 对折标
// 折痕在 30mm 的正中间，两侧各为 15×25mm 的可见面，内容不得跨越折痕
const LABEL_W = 30;
const LABEL_H = 25;
const FOLD_X = LABEL_W / 2;
// 二维码占左半面，与折痕 / 标签边缘各留 1mm 的白边兼作静区
const QR_SIZE = 13;
const QR_X = (FOLD_X - QR_SIZE) / 2;
const QR_Y = (LABEL_H - QR_SIZE) / 2;
// 右半面文字区
const TEXT_X = FOLD_X + 1;
const TEXT_W = LABEL_W - TEXT_X - 1;
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

/**
 * 将单张标签渲染到 canvas（使用浏览器字体，支持中文，避免 PDF 内置字体乱码）。
 * 版面：左半面二维码居中，右半面从上到下为编号与名称。返回 PNG DataURL。
 */
async function renderLabelImage(
  qrDataUrl: string,
  code: string,
  name: string,
): Promise<string> {
  const w = LABEL_W * PX_PER_MM;
  const h = LABEL_H * PX_PER_MM;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);

  const qrImg = await loadImage(qrDataUrl);
  ctx.drawImage(
    qrImg,
    QR_X * PX_PER_MM,
    QR_Y * PX_PER_MM,
    QR_SIZE * PX_PER_MM,
    QR_SIZE * PX_PER_MM,
  );

  const textX = TEXT_X * PX_PER_MM;
  const textW = TEXT_W * PX_PER_MM;
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.fillStyle = "#000";

  ctx.font = "600 15px 'Consolas', 'Microsoft YaHei', monospace";
  ctx.fillText(truncate(ctx, code, textW), textX, 7 * PX_PER_MM);

  ctx.font = "700 20px 'Microsoft YaHei', sans-serif";
  wrapText(ctx, name, textW, 3).forEach((ln, i) => {
    ctx.fillText(ln, textX, (10 + i * 2.5) * PX_PER_MM);
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
  const doc = new jsPDF({ unit: "mm", format, orientation: "landscape" });

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (i > 0) doc.addPage(format, "landscape");

    const qr = await QRCode.toDataURL(buildQrPayload(item, origin), {
      // 静区交给标签上的 1mm 白边，此处不再额外留，以保证模块尽量大
      margin: 0,
      width: 480,
      errorCorrectionLevel: "M",
    });
    const labelImg = await renderLabelImage(qr, item.code, item.name);
    doc.addImage(labelImg, "PNG", 0, 0, LABEL_W, LABEL_H);
  }

  doc.save(`labels-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** 旧入口保留兼容：现统一改为保存 PDF。 */
export async function printLabels(items: LabelItem[]): Promise<void> {
  return saveLabelsPdf(items);
}
