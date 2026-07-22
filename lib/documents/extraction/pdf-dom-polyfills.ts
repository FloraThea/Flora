import { createRequire } from "node:module";
import path from "node:path";

/**
 * Polyfills navigateur minimaux pour pdf.js en Node (Vercel / Serverless).
 * Appelé avant tout chargement de pdf-parse.
 */
export function installPdfDomPolyfills(): void {
  if (typeof globalThis.DOMMatrix !== "undefined") return;

  try {
    const rootRequire = createRequire(path.join(process.cwd(), "package.json"));
    const canvas = rootRequire("@napi-rs/canvas") as {
      DOMMatrix?: typeof DOMMatrix;
      ImageData?: typeof ImageData;
      Path2D?: typeof Path2D;
    };

    if (canvas.DOMMatrix) globalThis.DOMMatrix = canvas.DOMMatrix;
    if (canvas.ImageData) globalThis.ImageData = canvas.ImageData;
    if (canvas.Path2D) globalThis.Path2D = canvas.Path2D;
  } catch {
    class MinimalDOMMatrix {
      a = 1;
      b = 0;
      c = 0;
      d = 1;
      e = 0;
      f = 0;
      m11 = 1;
      m12 = 0;
      m21 = 0;
      m22 = 1;
      m41 = 0;
      m42 = 0;
      is2D = true;
      isIdentity = true;
      scaleSelf() {
        return this;
      }
      translateSelf() {
        return this;
      }
      multiplySelf() {
        return this;
      }
      preMultiplySelf() {
        return this;
      }
      invertSelf() {
        return this;
      }
      transformPoint(point?: DOMPointInit) {
        return { x: point?.x ?? 0, y: point?.y ?? 0, z: 0, w: 1 };
      }
    }

    globalThis.DOMMatrix = MinimalDOMMatrix as unknown as typeof DOMMatrix;
  }
}
