"use client";

import { useEffect, useRef } from "react";

/** Adds data-visible="true" when the element scrolls into view (pairs with `.reveal`). */
export function useReveal<T extends HTMLElement>(options: IntersectionObserverInit = { rootMargin: "0px 0px -10% 0px" }) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.dataset.visible = "true";
        observer.disconnect();
      }
    }, options);
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}
