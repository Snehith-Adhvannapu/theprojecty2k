// Payment-proof storage. Cloudinary when CLOUDINARY_URL is set (cloudinary://key:secret@cloud),
// otherwise the screenshot goes into the database (fine for local dev and small events).
// Proofs are only ever shown to admins, through /api/admin/orders/[id]/proof.
import crypto from "node:crypto";
import { AppError } from "@/lib/errors";

export const MAX_PROOF_BYTES = 1_500_000;

export type StoredProof = { url: string; data: null; mime: string } | { url: null; data: Buffer; mime: string };

/** Detects the real image type from magic bytes. The client's declared type is never trusted. */
export function sniffImage(b: Buffer): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 12 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (b.length > 12 && b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "image/webp";
  return null;
}

function cloudinaryCreds() {
  const raw = process.env.CLOUDINARY_URL;
  if (!raw) return null;
  const m = /^cloudinary:\/\/([^:]+):([^@]+)@(.+)$/.exec(raw.trim());
  return m ? { key: m[1], secret: m[2], cloud: m[3] } : null;
}

/** Reads a proof stored with an s3:// url. */
export async function readS3Proof(url: string): Promise<Buffer> {
  const m = /^s3:\/\/([^/]+)\/(.+)$/.exec(url);
  if (!m) throw new AppError("NOT_FOUND", "No proof on this order.", 404);
  const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");
  const out = await new S3Client({}).send(new GetObjectCommand({ Bucket: m[1], Key: m[2] }));
  return Buffer.from(await out.Body!.transformToByteArray());
}

export async function storeProof(bytes: Buffer): Promise<StoredProof> {
  if (bytes.length > MAX_PROOF_BYTES) throw new AppError("FILE_TOO_BIG", "That image is too large. Try a smaller screenshot.", 413);
  const mime = sniffImage(bytes);
  if (!mime) throw new AppError("BAD_FILE", "Upload a JPG, PNG or WebP screenshot.", 400);

  // S3 first (private bucket, server role credentials). Stored as s3://bucket/key and only ever read back by admins.
  const bucket = process.env.S3_UPLOADS_BUCKET;
  if (bucket) {
    const key = `proofs/${crypto.randomBytes(24).toString("base64url")}`;
    try {
      const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
      await new S3Client({}).send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: bytes, ContentType: mime }));
    } catch {
      throw new AppError("UPLOAD_FAILED", "Couldn't upload your screenshot. Please try again.", 502);
    }
    return { url: `s3://${bucket}/${key}`, data: null, mime };
  }

  const c = cloudinaryCreds();
  if (!c) return { url: null, data: bytes, mime };
  // Unguessable id; the URL is only ever handed to admins.
  const publicId = `y2k-proofs/${crypto.randomBytes(24).toString("base64url")}`;
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHash("sha1").update(`public_id=${publicId}&timestamp=${timestamp}${c.secret}`).digest("hex");
  const form = new FormData();
  form.set("file", `data:${mime};base64,${bytes.toString("base64")}`);
  form.set("api_key", c.key);
  form.set("timestamp", String(timestamp));
  form.set("public_id", publicId);
  form.set("signature", signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${c.cloud}/image/upload`, {
    method: "POST", body: form, signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new AppError("UPLOAD_FAILED", "Couldn't upload your screenshot. Please try again.", 502);
  const j = (await res.json()) as { secure_url?: string };
  if (!j.secure_url) throw new AppError("UPLOAD_FAILED", "Couldn't upload your screenshot. Please try again.", 502);
  return { url: j.secure_url, data: null, mime };
}
