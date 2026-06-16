"use client";
import { useEffect } from "react";

// Registers a minimal service worker so the app is installable
// ("Add to Home Screen") on Android Chrome. Does no caching.
export default function RegisterSW() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
