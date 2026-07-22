import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * pdf-parse : build CJS externalisé (require), legacy pdf.js inliné.
   * @napi-rs/canvas : binaires natifs pour OCR / polyfills DOMMatrix.
   */
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas", "tesseract.js", "pg"],
  outputFileTracingIncludes: {
    "/api/**": [
      "./node_modules/pdf-parse/**/*",
      "./node_modules/@napi-rs/canvas/**/*",
    ],
    "/*": [
      "./node_modules/pdf-parse/**/*",
      "./node_modules/@napi-rs/canvas/**/*",
    ],
  },
  experimental: {
    /** Import programmation : fichiers jusqu'à 25 Mo (fallback si upload direct indisponible). */
    proxyClientMaxBodySize: "28mb",
  },
};

export default nextConfig;
