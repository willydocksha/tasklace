"use client";
import { createContext, useContext } from "react";
import type { User } from "@/lib/auth";
import type { Perms } from "@/lib/permissions";
import { firstSubtaskList } from "@/lib/flow";
import type { BoardData, Card } from "@/lib/types";

export type BoardCtx = {
  data: BoardData;
  user: User;
  refresh: () => Promise<void>;
  // runs a mutation, then reloads the board; errors are surfaced as alerts
  mutate: (fn: () => Promise<unknown>) => Promise<void>;
  openCard: (id: string) => void;
  isAdmin: boolean;
  // what the user may do here (see lib/permissions.ts)
  perms: Perms;
  canEdit: (c: Card) => boolean;
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
  // jira-style issue key, e.g. TLC-12
  const keyOf = (c: Card) => `${data.board.key}-${c.number}`;
  // story point totals of a set of cards
  const points = (cards: Card[]) => {
    const total = cards.reduce((s, c) => s + (c.points ?? 0), 0);
    const done = cards.filter(isDone).reduce((s, c) => s + (c.points ?? 0), 0);
    return { total, done };
  };
  return { doneLists, byId, isDone, childrenOf, progress, keyOf, points };
}

// done/total of a card's subtasks; a subtask without status sits in the first subtask list
export function subtaskProgress(data: BoardData, card: Card) {
  const doneLists = new Set(data.lists.filter((l) => l.is_done).map((l) => l.id));
  const first = firstSubtaskList(data.lists)?.id;
  const total = card.subtasks.length;
  const done = card.subtasks.filter((s) => doneLists.has(s.list_id ?? first ?? "")).length;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}

export function formatDate(d: string | null) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export const today = () => new Date().toISOString().slice(0, 10);

// whole calendar days from today until a date (negative when past)
export const daysLeft = (end: string | null) => (end ? Math.round((Date.parse(end) - Date.parse(today())) / 86400_000) : null);
