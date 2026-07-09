import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pdf-parse",
    "pdfjs-dist",
    "tesseract.js",
    "@napi-rs/canvas",
    "pg",
  ],
  experimental: {
    proxyClientMaxBodySize: "6mb",
  },
};

export default nextConfig;
