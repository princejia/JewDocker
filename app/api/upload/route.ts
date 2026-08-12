import { NextRequest, NextResponse } from "next/server";
import OSS from "ali-oss";
import { randomUUID } from "node:crypto";
import { extname } from "node:path";

export const runtime = "nodejs";

const PREFIX = "product-images";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const DOC_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];
const ALLOWED_TYPES = [...IMAGE_TYPES, ...DOC_TYPES];
const MAX_SIZE = 10 * 1024 * 1024;

// 只允许由内容类型推导扩展名，避免用户文件名参与对象键的构造
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
};

function readConfig() {
  const region = process.env.OSS_REGION;
  const bucket = process.env.OSS_BUCKET;
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID;
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET;
  if (!region || !bucket || !accessKeyId || !accessKeySecret) return null;

  const baseUrl =
    process.env.OSS_PUBLIC_BASE_URL?.replace(/\/$/, "") ??
    `https://${bucket}.${region}.aliyuncs.com`;

  return { region, bucket, accessKeyId, accessKeySecret, baseUrl };
}

export async function POST(req: NextRequest) {
  const config = readConfig();
  if (!config) {
    return NextResponse.json(
      {
        error:
          "服务端未配置对象存储（OSS_REGION / OSS_BUCKET / OSS_ACCESS_KEY_ID / OSS_ACCESS_KEY_SECRET）",
      },
      { status: 500 }
    );
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "未提供文件" }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: "只支持 JPG/PNG/WEBP 图片或 PDF/Word 文档" },
      { status: 400 }
    );
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "文件大小不能超过 10MB" },
      { status: 400 }
    );
  }

  const client = new OSS({
    region: config.region,
    bucket: config.bucket,
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    secure: true,
  });

  const key = `${PREFIX}/${randomUUID()}${EXT_BY_TYPE[file.type] ?? extname(file.name)}`;

  try {
    await client.put(key, Buffer.from(await file.arrayBuffer()), {
      headers: {
        "Content-Type": file.type,
        // 文档类强制下载，避免在 OSS 域名下渲染 HTML 造成的 XSS
        "Content-Disposition": DOC_TYPES.includes(file.type)
          ? "attachment"
          : "inline",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `上传失败：${message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: `${config.baseUrl}/${key}` });
}
