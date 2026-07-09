import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Flora — Espace pédagogique",
    short_name: "Flora",
    description: "Assistant pédagogique pour enseignants du primaire",
    start_url: "/planificateur-annuel",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f4f7f2",
    theme_color: "#4a6752",
    lang: "fr",
    categories: ["education", "productivity"],
    icons: [
      {
        src: "/icons/flora-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/flora-icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
