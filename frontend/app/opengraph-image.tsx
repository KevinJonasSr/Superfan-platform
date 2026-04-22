import { ImageResponse } from "next/og";

// ─── OG card for every page that doesn't override it ──────────────────────
// 1200x630 is the canonical Twitter/LinkedIn/Slack preview size. Generated at
// request time via Next's ImageResponse so we don't have to ship a binary.

export const runtime = "edge";
export const alt = "Fan Engage — the superfan platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: "80px",
          // Radial aurora + midnight base
          background:
            "radial-gradient(circle at 15% 10%, rgba(124,58,237,0.35), transparent 50%), " +
            "radial-gradient(circle at 85% 90%, rgba(251,146,60,0.25), transparent 55%), " +
            "#050b1f",
          color: "white",
          fontFamily: "sans-serif",
        }}
      >
        {/* Brand mark */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              display: "flex",
              width: 64,
              height: 64,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 999,
              background: "linear-gradient(135deg, #7c3aed, #fb923c)",
              fontSize: 28,
              fontWeight: 700,
              color: "white",
            }}
          >
            FE
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 600,
              letterSpacing: "-0.02em",
            }}
          >
            Fan Engage
          </div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              fontSize: 84,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: "-0.035em",
              maxWidth: 980,
            }}
          >
            Your favorite artists.
          </div>
          <div
            style={{
              fontSize: 84,
              fontWeight: 700,
              lineHeight: 1.02,
              letterSpacing: "-0.035em",
              background:
                "linear-gradient(90deg, #a78bfa, #f0abfc, #fb923c)",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            Your front-row seat.
          </div>
        </div>

        {/* Footer row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 24,
            color: "rgba(255,255,255,0.7)",
          }}
        >
          <div>The superfan platform — rewards, community, drops.</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            Join free →
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
