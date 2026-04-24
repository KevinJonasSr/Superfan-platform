"use client";

import { useRef, useState } from "react";

/**
 * Video file picker that uploads to /api/upload/video with progress bar.
 * Captures a poster frame from the video and uploads it to /api/upload (image bucket).
 * Both URLs are written to hidden inputs so they ride with form submission.
 */
export default function VideoUploader({
  name = "video_url",
  posterName = "video_poster_url",
  initialUrl = null,
  label = "Add video (optional)",
  onUploaded,
}: {
  name?: string;
  posterName?: string;
  initialUrl?: string | null;
  label?: string;
  onUploaded?: (videoUrl: string, posterUrl: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(initialUrl);
  const [posterUrl, setPosterUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function capturePosterFrame(videoFile: File): Promise<string | null> {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        // Seek to 1 second (or video duration / 2 if video is shorter)
        video.currentTime = Math.min(1, video.duration / 2);
      };

      video.onseeked = () => {
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          canvas.toBlob(async (blob) => {
            if (!blob) {
              resolve(null);
              return;
            }
            // Upload poster to image bucket
            try {
              const fd = new FormData();
              fd.append("file", blob);
              fd.append("bucket", "community-uploads");
              const res = await fetch("/api/upload", { method: "POST", body: fd });
              const payload = await res.json();
              if (!res.ok) {
                resolve(null);
                return;
              }
              resolve(payload.url);
            } catch {
              resolve(null);
            }
          }, "image/jpeg");
        }
      };

      video.onerror = () => resolve(null);
      video.src = URL.createObjectURL(videoFile);
    });
  }

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size before upload
    if (file.size > 50 * 1024 * 1024) {
      setError("Video exceeds 50 MB limit");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    setError(null);
    setProgress(0);
    setUploading(true);

    try {
      // Upload video using XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();

      xhr.upload.onprogress = (evt) => {
        if (evt.lengthComputable) {
          const pct = Math.round((evt.loaded / evt.total) * 100);
          setProgress(pct);
        }
      };

      xhr.onload = async () => {
        if (xhr.status !== 200) {
          const payload = JSON.parse(xhr.responseText);
          setError(payload.error ?? "Upload failed");
          setUploading(false);
          if (inputRef.current) inputRef.current.value = "";
          return;
        }

        const payload = JSON.parse(xhr.responseText);
        const vUrl = payload.url as string;

        // Capture poster frame from the file
        const pUrl = await capturePosterFrame(file);

        setVideoUrl(vUrl);
        setPosterUrl(pUrl ?? null);
        onUploaded?.(vUrl, pUrl ?? null);
        setUploading(false);
        setProgress(0);
        if (inputRef.current) inputRef.current.value = "";
      };

      xhr.onerror = () => {
        setError("Upload failed");
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      };

      const fd = new FormData();
      fd.append("file", file);
      xhr.open("POST", "/api/upload/video");
      xhr.send(fd);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleRemove() {
    setVideoUrl(null);
    setPosterUrl(null);
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={videoUrl ?? ""} />
      <input type="hidden" name={posterName} value={posterUrl ?? ""} />
      <input
        ref={inputRef}
        type="file"
        accept=".mp4,.webm,.mov,video/mp4,video/webm,video/quicktime"
        onChange={handlePick}
        className="hidden"
      />

      {videoUrl ? (
        <div className="space-y-2">
          <video
            controls
            poster={posterUrl ?? undefined}
            preload="metadata"
            playsInline
            className="mt-3 w-full max-w-xs rounded-2xl border border-white/10"
          >
            <source src={videoUrl} />
          </video>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="rounded-full border border-white/20 px-3 py-1 text-xs text-white/70 hover:bg-white/10 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Replace"}
            </button>
            <button
              type="button"
              onClick={handleRemove}
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
          {uploading ? `Uploading… ${progress}%` : `🎬 ${label}`}
        </button>
      )}

      {uploading && progress > 0 && (
        <div className="space-y-1">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-aurora to-ember transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-white/60">{progress}%</p>
        </div>
      )}

      {error && <p className="text-xs text-rose-300">{error}</p>}
    </div>
  );
}
