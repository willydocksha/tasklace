"use client";
import { useEffect, useState } from "react";
import { THEME_KEY as KEY } from "./themeScript";

export type ThemeMode = "light" | "dark" | "system";


const prefersDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

// apply a mode to <html>
function apply(mode: ThemeMode) {
  document.documentElement.classList.toggle("dark", mode === "dark" || (mode === "system" && prefersDark()));
}

// current mode + setter; follows the os while on "system"
export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>("system");
  const [dark, setDark] = useState(false);

  // read the saved choice once mounted
  useEffect(() => {
    let saved: ThemeMode = "system";
    try {
      saved = (localStorage.getItem(KEY) as ThemeMode) || "system";
    } catch {}
    setMode(saved);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  // track os changes while on system
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const on = () => (apply("system"), setDark(mq.matches));
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [mode]);

  function set(m: ThemeMode) {
    try {
      localStorage.setItem(KEY, m);
    } catch {}
    apply(m);
    setMode(m);
    setDark(document.documentElement.classList.contains("dark"));
    // other open components (e.g. the second switch) follow along
    window.dispatchEvent(new CustomEvent("tl-theme", { detail: m }));
  }

  // stay in sync with switches elsewhere on the page
  useEffect(() => {
    const on = (e: Event) => {
      setMode((e as CustomEvent<ThemeMode>).detail);
      setDark(document.documentElement.classList.contains("dark"));
    };
    window.addEventListener("tl-theme", on);
    return () => window.removeEventListener("tl-theme", on);
  }, []);

  return { mode, dark, set };
}
