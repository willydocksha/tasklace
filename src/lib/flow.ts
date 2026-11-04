import type { List } from "./types";

// whether a card may move from one list to another under the board's status flow
export function canMove(from: Pick<List, "id" | "next_ids"> | undefined, toId: string) {
  if (!from || from.id === toId || !from.next_ids) return true;
  return from.next_ids.includes(toId);
}

// error shown when a move breaks the flow
export const flowError = (from: string, to: string) => `Alur status tidak mengizinkan pindah dari "${from}" ke "${to}".`;

// lists a card in `fromId` may move to, nearest following list first
export function nextOptions<L extends Pick<List, "id" | "position" | "next_ids">>(lists: L[], fromId: string | null) {
  const sorted = [...lists].sort((a, b) => a.position - b.position);
  const from = sorted.find((l) => l.id === fromId);
  const pos = from?.position ?? -1;
  return sorted
    .filter((l) => l.id !== from?.id && canMove(from, l.id))
    .sort((a, b) => Number(a.position < pos) - Number(b.position < pos) || a.position - b.position);
}
