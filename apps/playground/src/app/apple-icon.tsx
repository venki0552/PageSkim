import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 18,
          paddingLeft: 36,
          background: "#0a5cff",
          borderRadius: 40,
        }}
      >
        <div style={{ width: 100, height: 16, borderRadius: 8, background: "#fff" }} />
        <div style={{ width: 70, height: 16, borderRadius: 8, background: "#fff", opacity: 0.85 }} />
        <div style={{ width: 40, height: 16, borderRadius: 8, background: "#fff", opacity: 0.7 }} />
      </div>
    ),
    size,
  );
}
