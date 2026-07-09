"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/sw.js").catch(() => {
      // Service worker optionnel — l'installation via « Ajouter à l'écran d'accueil » reste possible.
    });
  }, []);

  return null;
}
