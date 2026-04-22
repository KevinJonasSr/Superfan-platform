import { ImageResponse } from "next/og";

// Branded favicon — the gradient "FE" mark. Replaces the default Next icon in
// browser tabs and link previews.

export const runtime = "edge";
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 999,
          background: "linear-gradient(135deg, #7c3aed, #fb923c)",
          color: "white",
          fontSize: 36,
          fontWeight: 700,
          fontFamily: "sans-serif",
          letterSpacing: "-0.03em",
        }}
      >
        FE
      </div>
    ),
    { ...size },
  );
}
