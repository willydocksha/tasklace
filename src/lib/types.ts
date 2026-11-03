export type CardType = "epic" | "story" | "task" | "bug";
export type Priority = "low" | "medium" | "high" | "urgent";

// direct is false when the user only has access through a team
export type Member = { id: string; name: string; email: string; color: string; role: string; direct: boolean };
export type Label = { id: string; name: string; color: string };
export type List = { id: string; name: string; position: number; is_done: number };
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
  created_at: number;
  labels: string[];
  assignees: string[];
  comment_count: number;
};
export type Board = {
  id: string;
  name: string;
  description: string;
  color: string;
  key: string;
  invite_code: string;
  owner_id: string;
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
export type BoardData = { board: Board; lists: List[]; cards: Card[]; labels: Label[]; members: Member[]; sprints: Sprint[]; role: string };
export type Comment = { id: string; body: string; created_at: number; user_id: string; name: string; color: string };
