"use client";

import { useEffect } from "react";

/**
 * Registers the service worker, and only in production.
 *
 * In development a worker that caches anything makes edits appear not to take,
 * which costs more time than it could ever save. `next dev` also serves
 * different asset URLs than a build, so there is nothing worth caching there.
 *
 * Registration failing is not an error worth showing anyone: it means the app
 * works exactly as it did before, minus the install prompt.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    };

    // After load, so registration never competes with the first paint.
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
