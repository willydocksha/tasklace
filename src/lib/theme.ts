import type { IconName } from "@/components/ui/Icon";

// board backgrounds: solid colors and gradients
export const BOARD_COLORS: Record<string, string> = {
  blue: "linear-gradient(135deg, #0c66e4, #0747a6)",
  green: "linear-gradient(135deg, #1f845a, #164b35)",
  orange: "linear-gradient(135deg, #e2772e, #a54800)",
  red: "linear-gradient(135deg, #c9372c, #8c1e15)",
  purple: "linear-gradient(135deg, #8f7ee7, #5e4db2)",
  pink: "linear-gradient(135deg, #e774bb, #943d73)",
  teal: "linear-gradient(135deg, #1d9aaa, #0b5f6b)",
  slate: "linear-gradient(135deg, #626f86, #2c3e5d)",
  sunset: "linear-gradient(135deg, #f97316, #db2777 60%, #7c3aed)",
  ocean: "linear-gradient(135deg, #06b6d4, #3b82f6 55%, #6366f1)",
  forest: "linear-gradient(135deg, #84cc16, #059669 60%, #0f766e)",
  night: "linear-gradient(135deg, #1e1b4b, #312e81 50%, #701a75)",
};

export const boardBg = (c: string) => BOARD_COLORS[c] ?? BOARD_COLORS.blue;

// built-in background scenes (light svg files in public/backgrounds)
export const BOARD_SCENES: Record<string, string> = {
  mountains: "Pegunungan",
  ocean: "Laut",
  aurora: "Aurora",
  dunes: "Gurun",
  hills: "Bukit",
  city: "Kota malam",
  forest: "Hutan",
  blobs: "Abstrak",
};

// what a board looks like: gradient color, optional background ("p:<scene>" or "u:<version>") and icon
export type BoardLook = { id: string; color: string; background?: string | null; icon?: string | null };

// image url of a board background, or null when it just uses its color
export function boardImage(b: BoardLook, thumb = false) {
  const bg = b.background;
  if (bg?.startsWith("p:") && BOARD_SCENES[bg.slice(2)]) return `/backgrounds/${bg.slice(2)}.svg`;
  if (bg?.startsWith("u:")) return `/api/boards/${b.id}/background?v=${bg.slice(2)}${thumb ? "&thumb=1" : ""}`;
  return null;
}

// css background for a board: the image over its gradient (shown while the image loads)
export function boardBackground(b: BoardLook, thumb = false) {
  const img = boardImage(b, thumb);
  return img ? `url("${img}") center / cover no-repeat, ${boardBg(b.color)}` : boardBg(b.color);
}

// icons a board can pick (names from components/ui/Icon)
export const BOARD_ICONS: readonly IconName[] = [
  "rocket", "briefcase", "code", "mobile", "globe", "home", "heart", "star", "bulb", "epic",
  "target", "flag", "chart", "cart", "wallet", "megaphone", "calendar", "users", "graduation", "story",
  "palette", "camera", "music", "gamepad", "coffee", "plane", "leaf", "wrench", "bug", "folder",
] as const;

export const LABEL_COLORS = ["#4bce97", "#f5cd47", "#fea362", "#f87168", "#9f8fef", "#579dff", "#6cc3e0", "#94c748", "#e774bb", "#8590a2"];

export const EPIC_COLORS = ["#8b5cf6", "#3b82f6", "#14b8a6", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#64748b"];

export const TYPE_META = {
  epic: { label: "Epic", color: "#8b5cf6", icon: "epic" },
  story: { label: "Story", color: "#22c55e", icon: "story" },
  task: { label: "Task", color: "#1e72e4", icon: "task" },
  bug: { label: "Bug", color: "#ef4444", icon: "bug" },
} as const;

export const PRIORITY_META = {
  low: { label: "Rendah", color: "#64748b" },
  medium: { label: "Sedang", color: "#1e72e4" },
  high: { label: "Tinggi", color: "#f59e0b" },
  urgent: { label: "Mendesak", color: "#ef4444" },
} as const;

// readable text color for a label background (dark text on light colors)
export function labelText(hex: string) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#172b4d";
  const n = parseInt(m[1], 16);
  const lum = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return lum > 0.55 ? "#172b4d" : "#ffffff";
}
