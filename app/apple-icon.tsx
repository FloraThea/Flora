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
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #f4f7f2 0%, #e8efe4 100%)",
          borderRadius: 36,
          border: "4px solid #c5d4b8",
        }}
      >
        <svg width="72" height="72" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2C12 2 6 8 6 13C6 16.31 8.69 19 12 19C15.31 19 18 16.31 18 13C18 8 12 2 12 2Z"
            fill="#4a6752"
          />
          <path
            d="M12 19V22M9 21H15"
            stroke="#3d5a44"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <div
          style={{
            marginTop: 8,
            fontSize: 28,
            fontWeight: 700,
            color: "#3d5a44",
            letterSpacing: -1,
            fontFamily: "system-ui, sans-serif",
          }}
        >
          Flora
        </div>
      </div>
    ),
    { ...size },
  );
}
