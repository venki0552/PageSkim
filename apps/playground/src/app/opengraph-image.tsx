import { ImageResponse } from "next/og";

export const alt = "PageSkim — make any page readable by agents at 10–50x fewer tokens";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 80,
          background: "#101114",
          color: "#e8e9eb",
          fontSize: 32,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 96,
              height: 96,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: 9,
              paddingLeft: 20,
              background: "#0a5cff",
              borderRadius: 24,
            }}
          >
            <div style={{ width: 52, height: 9, borderRadius: 5, background: "#fff" }} />
            <div style={{ width: 36, height: 9, borderRadius: 5, background: "#fff", opacity: 0.85 }} />
            <div style={{ width: 20, height: 9, borderRadius: 5, background: "#fff", opacity: 0.7 }} />
          </div>
          <div style={{ fontSize: 72, fontWeight: 700 }}>PageSkim</div>
        </div>
        <div style={{ marginTop: 40, fontSize: 40, color: "#9ba0a8", display: "flex" }}>
          Make any page readable by LLMs and agents
        </div>
        <div style={{ marginTop: 16, fontSize: 40, color: "#9ba0a8", display: "flex" }}>
          at 10–50x fewer tokens — static files only.
        </div>
        <div style={{ marginTop: 56, display: "flex", alignItems: "center", gap: 20, fontSize: 44 }}>
          <span style={{ color: "#8a8f98" }}>142,687 tokens</span>
          <span style={{ color: "#6ea8ff" }}>→</span>
          <span style={{ color: "#e8e9eb" }}>7,625</span>
          <span style={{ color: "#6ea8ff" }}>→</span>
          <span style={{ color: "#4ade80", fontWeight: 700 }}>165</span>
        </div>
      </div>
    ),
    size,
  );
}
