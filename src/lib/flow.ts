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

type SubList = Pick<List, "id" | "position" | "next_ids" | "subtask" | "subtask_next_ids">;

// lists as subtasks see them: each list's next_ids becomes the explicit subtask targets
// (own flow or card flow, always limited to lists used by subtasks)
export function subtaskFlow<L extends SubList>(lists: L[], ownFlow: boolean): L[] {
  const used = lists.filter((l) => l.subtask).map((l) => l.id);
  return lists.map((l) => {
    const rule = ownFlow ? l.subtask_next_ids : l.next_ids;
    const next = (rule ?? used).filter((id) => id !== l.id && used.includes(id));
    return { ...l, next_ids: next };
  });
}

// status a new (or status-less) subtask sits in: the first list used by subtasks
export function firstSubtaskList<L extends Pick<List, "id" | "position" | "subtask">>(lists: L[]) {
  const sorted = [...lists].sort((a, b) => a.position - b.position);
  return sorted.find((l) => l.subtask) ?? sorted[0];
}
