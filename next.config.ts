import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "pdf-parse",
    "@napi-rs/canvas",
    "tesseract.js",
    "pg",
  ],
  experimental: {
    /** Import programmation : fichiers jusqu'à 25 Mo (fallback si upload direct indisponible). */
    proxyClientMaxBodySize: "28mb",
  },
};

export default nextConfig;
