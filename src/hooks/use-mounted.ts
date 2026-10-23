"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** true only on the client after hydration — avoids wallet-state hydration mismatches. */
export function useMounted() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
