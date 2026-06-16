import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";
import { r2, R2_BUCKET, R2_PUBLIC_BASE_URL } from "@/lib/r2";

export const dynamic = "force-dynamic";

const ALLOWED = new Set([
  "image/jpeg", "image/png", "image/webp", "image/heic", "image/heif",
  "video/mp4", "video/quicktime", "video/webm",
]);

function extFromType(t) {
  const map = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
    "image/heic": "heic", "image/heif": "heif",
    "video/mp4": "mp4", "video/quicktime": "mov", "video/webm": "webm",
  };
  return map[t] || "bin";
}

// POST /api/upload-url
// body: { contentType, mediaType, clientCode }
// returns a presigned PUT URL + the object key + the eventual public URL
export async function POST(req) {
  try {
    const { contentType, mediaType, clientCode } = await req.json();

    if (!ALLOWED.has(contentType)) {
      return NextResponse.json({ error: "Unsupported file type." }, { status: 400 });
    }
    if (!["photo", "video"].includes(mediaType)) {
      return NextResponse.json({ error: "Invalid media type." }, { status: 400 });
    }

    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const safeClient = (clientCode || "unsorted").toLowerCase().replace(/[^a-z0-9-]/g, "-");
    const key = `${safeClient}/${date}/${randomUUID()}.${extFromType(contentType)}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      ContentType: contentType,
    });
    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 300 });
    const publicUrl = `${R2_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`;

    return NextResponse.json({ uploadUrl, key, publicUrl });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
