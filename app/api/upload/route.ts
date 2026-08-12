import { NextRequest, NextResponse } from "next/server";
import COS from "cos-nodejs-sdk-v5";
import { randomUUID } from "node:crypto";

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
  const region = process.env.COS_REGION;
  const bucket = process.env.COS_BUCKET;
  const secretId = process.env.COS_SECRET_ID;
  const secretKey = process.env.COS_SECRET_KEY;
  if (!region || !bucket || !secretId || !secretKey) return null;

  // 留空的环境变量是空串而非 undefined，用 || 才能正确回落
  const baseUrl =
    process.env.COS_PUBLIC_BASE_URL?.replace(/\/$/, "") ||
    `https://${bucket}.cos.${region}.myqcloud.com`;

  return { region, bucket, secretId, secretKey, baseUrl };
}

export async function POST(req: NextRequest) {
  const config = readConfig();
  if (!config) {
    return NextResponse.json(
      {
        error:
          "服务端未配置对象存储（COS_REGION / COS_BUCKET / COS_SECRET_ID / COS_SECRET_KEY）",
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

  const cos = new COS({
    SecretId: config.secretId,
    SecretKey: config.secretKey,
  });

  const key = `${PREFIX}/${randomUUID()}${EXT_BY_TYPE[file.type]}`;
  const body = Buffer.from(await file.arrayBuffer());

  try {
    await new Promise<void>((resolve, reject) => {
      cos.putObject(
        {
          Bucket: config.bucket,
          Region: config.region,
          Key: key,
          Body: body,
          ContentType: file.type,
          // 文档类强制下载，避免在存储域名下渲染 HTML 造成的 XSS
          ContentDisposition: DOC_TYPES.includes(file.type)
            ? "attachment"
            : "inline",
          CacheControl: "public, max-age=31536000, immutable",
        },
        (err) => (err ? reject(err) : resolve())
      );
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
