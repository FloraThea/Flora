import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** pdf-parse est bundlé (import dynamique) ; canvas/tesseract/pg restent natifs/externalisés. */
  serverExternalPackages: ["@napi-rs/canvas", "tesseract.js", "pg"],
  outputFileTracingIncludes: {
    "/*": ["./node_modules/@napi-rs/canvas/**/*"],
  },
  experimental: {
    /** Import programmation : fichiers jusqu'à 25 Mo (fallback si upload direct indisponible). */
    proxyClientMaxBodySize: "28mb",
  },
};

export default nextConfig;
