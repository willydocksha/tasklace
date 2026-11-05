import type { Perms } from "./permissions";

export type CardType = "epic" | "story" | "task" | "bug";
export type Priority = "low" | "medium" | "high" | "urgent";

// direct is false when the user only has access through a team
export type Member = { id: string; name: string; email: string; username: string | null; color: string; avatar: string | null; role: string; direct: boolean };
export type Label = { id: string; name: string; color: string };
// next_ids: lists a card here may move to (null = any list)
// subtask: subtasks may use this status; subtask_next_ids: subtask flow when the board has its own (null = any)
// workflow_key: the team workflow status this list is synced from
export type List = {
  id: string;
  name: string;
  position: number;
  is_done: number;
  color: string | null;
  next_ids: string[] | null;
  subtask: boolean;
  subtask_next_ids: string[] | null;
  workflow_key: string | null;
};
export type Card = {
  id: string;
  list_id: string;
  parent_id: string | null;
  type: CardType;
  title: string;
  description: string;
  color: string | null;
  priority: Priority;
  start_date: string | null;
  due_date: string | null;
  position: number;
  number: number;
  points: number | null;
  sprint_id: string | null;
  created_by: string | null;
  created_at: number;
  labels: string[];
  assignees: string[];
  comment_count: number;
  attachment_count: number;
  subtasks: Subtask[];
};
// plain-text checklist item of a card; list_id null means the board's first list
export type Subtask = { id: string; card_id: string; title: string; list_id: string | null; position: number; assignees: string[] };
export type Board = {
  id: string;
  name: string;
  description: string;
  color: string;
  background: string | null;
  icon: string | null;
  photo: number | null; // version of the uploaded background photo, if any
  key: string;
  invite_code: string;
  owner_id: string;
  // subtasks use their own flow instead of the card flow
  subtask_own_flow: boolean;
  // team workflow this board follows (statuses and flow are edited there)
  workflow: { id: string; name: string; team_id: string; team_name: string } | null;
};
export type SprintStatus = "planned" | "active" | "completed";
export type Sprint = {
  id: string;
  name: string;
  goal: string;
  start_date: string | null;
  end_date: string | null;
  status: SprintStatus;
  created_at: number;
};
export type BoardData = { board: Board; lists: List[]; cards: Card[]; labels: Label[]; members: Member[]; sprints: Sprint[]; role: string; perms: Perms };
export type Comment = { id: string; body: string; created_at: number; user_id: string; name: string; color: string; avatar: string | null };

// an image attached to a card (bytes live at /api/attachments/[id])
export type Attachment = { id: string; name: string; width: number; height: number; size: number; created_at: number; user_id: string | null; user_name: string | null };

// one entry of a card's history (see lib/activity.ts for kinds)
export type Activity = {
  id: string;
  kind: string;
  data: Record<string, unknown>;
  created_at: number;
  user_id: string | null;
  name: string | null;
  color: string | null;
  avatar: string | null;
};
