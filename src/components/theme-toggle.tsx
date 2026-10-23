"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const THEME_STORAGE_KEY = "chainly-theme";

/** Runs before first paint (see layout.tsx) so there is no theme flash. */
export const THEME_INIT_SCRIPT = `(function(){try{if(localStorage.getItem("${THEME_STORAGE_KEY}")==="light")document.documentElement.classList.remove("dark")}catch(e){}})()`;

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function useIsDark() {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => true,
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const isDark = useIsDark();
  const toggle = () => {
    const next = !isDark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // storage unavailable — theme still switches for this session
    }
  };
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={toggle}
      className={cn("relative", className)}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      <Sun className={cn("absolute transition-all duration-300", isDark ? "scale-0 -rotate-90 opacity-0" : "scale-100 opacity-100")} />
      <Moon className={cn("absolute transition-all duration-300", isDark ? "scale-100 opacity-100" : "scale-0 rotate-90 opacity-0")} />
    </Button>
  );
}
