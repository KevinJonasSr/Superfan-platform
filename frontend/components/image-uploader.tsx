"use client";

import { useRef, useState } from "react";

type Bucket = "community-uploads" | "avatars";

const MAX_DIMENSION = 1920; // px on longest edge after resize
const JPEG_QUALITY = 0.85;
const VERCEL_BODY_LIMIT = 4 * 1024 * 1024; // 4 MB — stay safely under Vercel's 4.5 MB serverless body limit

/**
 * File picker that uploads via POST /api/upload and writes the returned URL
 * into a hidden input (so it rides with a regular server action FormData
 * submission). Keeps the rest of the form flow exactly as before.
 *
 * Resizes images client-side before upload to avoid Vercel's 4.5 MB
 * serverless-function body limit. A modern phone photo (5–10 MB) gets
 * shrunk to a few hundred KB at 1920px / JPEG q=0.85, which is plenty
 * for hero images and post attachments.
 */
export default function ImageUploader({
  bucket,
  name = "image_url",
  initialUrl = null,
  label = "Add photo",
  onUploaded,
}: {
  bucket: Bucket;
  /** Hidden input name that carries the uploaded URL on submit. */
  name?: string;
  initialUrl?: string | null;
  label?: string;
  onUploaded?: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      // GIFs are passed through unchanged — canvas re-encoding would lose animation.
      const blob =
        file.type === "image/gif"
          ? file
          : await resizeImage(file, (msg) => setStatus(msg));

      // Sanity check after resize: if still over the wire limit, refuse early
      // with a clear message instead of letting Vercel kick it back as plain text.
      if (blob.size > VERCEL_BODY_LIMIT) {
        throw new Error(
          `Image is still ${(blob.size / 1024 / 1024).toFixed(1)} MB after compression. ` +
            "Try a smaller source image.",
        );
      }

      setStatus("Uploading…");
      const fd = new FormData();
      fd.append(
        "file",
        blob,
        // Force .jpg extension if we re-encoded; keep original name for GIF.
        blob === file ? file.name : `${stripExt(file.name)}.jpg`,
      );
      fd.append("bucket", bucket);

      const res = await fetch("/api/upload", { method: "POST", body: fd });

      // Vercel can return plain-text errors (e.g. "Request Entity Too Large")
      // *before* our route runs. Read body as text first, then parse JSON only
      // if the content-type indicates JSON.
      const ct = res.headers.get("content-type") ?? "";
      const text = await res.text();
      let payload: { url?: string; error?: string } = {};
      if (ct.includes("application/json")) {
        try {
          payload = JSON.parse(text);
        } catch {
          // fall through, treat as text error
        }
      }

      if (!res.ok || !payload.url) {
        const msg =
          payload.error ??
          (text && text.length < 200 ? text.trim() : `Upload failed (${res.status})`);
        throw new Error(msg);
      }

      setUrl(payload.url);
      onUploaded?.(payload.url);
      setStatus(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setStatus(null);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={url ?? ""} />
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handlePick}
        className="hidden"
      />
      {url ? (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt=""
            className="max-h-64 w-full rounded-2xl border border-white/10 object-cover"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70 hover:bg-white/10 disabled:opacity-50"
            >
              {uploading ? status ?? "Uploading…" : "Replace"}
            </button>
            <button
              type="button"
              onClick={() => setUrl(null)}
              className="rounded-full border border-white/20 px-3 py-1 text-xs text-rose-300/80 hover:text-rose-300"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="rounded-full border border-dashed border-white/20 bg-black/30 px-4 py-2 text-xs text-white/70 hover:bg-black/50 disabled:opacity-50"
        >
          {uploading ? status ?? "Uploading…" : `📷 ${label}`}
        </button>
      )}
      {error && <p className="text-xs text-rose-300">{error}</p>}
    </div>
  );
}

/**
 * Resize an image File to at most MAX_DIMENSION on the longest edge,
 * encode as JPEG at JPEG_QUALITY. Returns a Blob suitable for upload.
 */
async function resizeImage(
  file: File,
  onProgress: (msg: string) => void,
): Promise<Blob> {
  onProgress("Reading image…");
  const dataUrl = await readAsDataUrl(file);

  onProgress("Decoding…");
  const img = await loadImage(dataUrl);

  const { width, height } = scaleToFit(img.width, img.height, MAX_DIMENSION);

  onProgress(`Resizing to ${width}×${height}…`);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");
  ctx.drawImage(img, 0, 0, width, height);

  onProgress("Compressing…");
  const blob: Blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob returned null"))),
      "image/jpeg",
      JPEG_QUALITY,
    );
  });
  return blob;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = src;
  });
}

function scaleToFit(
  w: number,
  h: number,
  max: number,
): { width: number; height: number } {
  if (w <= max && h <= max) return { width: w, height: h };
  const ratio = w > h ? max / w : max / h;
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

function stripExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}
