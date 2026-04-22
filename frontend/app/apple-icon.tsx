import { ImageResponse } from "next/og";

// iOS / iPadOS home-screen icon. 180x180 is the canonical size Safari looks
// for; other sizes get derived from PWA manifest icons.

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          // No border radius — iOS applies its own rounded mask.
          background: "linear-gradient(135deg, #7c3aed, #fb923c)",
          color: "white",
          fontSize: 96,
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
