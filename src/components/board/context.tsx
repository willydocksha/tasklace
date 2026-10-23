"use client";
import { createContext, useContext } from "react";
import type { User } from "@/lib/auth";
import type { BoardData, Card } from "@/lib/types";

export type BoardCtx = {
  data: BoardData;
  user: User;
  refresh: () => Promise<void>;
  // runs a mutation, then reloads the board; errors are surfaced as alerts
  mutate: (fn: () => Promise<unknown>) => Promise<void>;
  openCard: (id: string) => void;
  isAdmin: boolean;
};

export const Ctx = createContext<BoardCtx | null>(null);
export const useBoard = () => useContext(Ctx)!;

export function cardHelpers(data: BoardData) {
  const doneLists = new Set(data.lists.filter((l) => l.is_done).map((l) => l.id));
  const byId = new Map(data.cards.map((c) => [c.id, c]));
  const isDone = (c: Card) => doneLists.has(c.list_id);
  const childrenOf = (epicId: string) => data.cards.filter((c) => c.parent_id === epicId);
  const progress = (epicId: string) => {
    const kids = childrenOf(epicId);
    const done = kids.filter(isDone).length;
    return { total: kids.length, done, pct: kids.length ? Math.round((done / kids.length) * 100) : 0 };
  };
  return { doneLists, byId, isDone, childrenOf, progress };
}

export function formatDate(d: string | null) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export const today = () => new Date().toISOString().slice(0, 10);
