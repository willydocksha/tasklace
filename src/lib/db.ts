import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");

const schema = `
create table if not exists users (
  id text primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  color text not null,
  created_at integer not null
);
create table if not exists sessions (
  token text primary key,
  user_id text not null references users(id) on delete cascade,
  expires_at integer not null
);
create table if not exists boards (
  id text primary key,
  name text not null,
  description text not null default '',
  color text not null,
  invite_code text not null unique,
  owner_id text not null references users(id),
  created_at integer not null
);
create table if not exists board_members (
  board_id text not null references boards(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role text not null default 'member',
  primary key (board_id, user_id)
);
create table if not exists lists (
  id text primary key,
  board_id text not null references boards(id) on delete cascade,
  name text not null,
  position integer not null,
  is_done integer not null default 0
);
create table if not exists cards (
  id text primary key,
  board_id text not null references boards(id) on delete cascade,
  list_id text not null references lists(id) on delete cascade,
  parent_id text references cards(id) on delete set null,
  type text not null default 'task',
  title text not null,
  description text not null default '',
  color text,
  priority text not null default 'medium',
  start_date text,
  due_date text,
  position integer not null,
  created_by text references users(id),
  created_at integer not null
);
create table if not exists labels (
  id text primary key,
  board_id text not null references boards(id) on delete cascade,
  name text not null,
  color text not null
);
create table if not exists card_labels (
  card_id text not null references cards(id) on delete cascade,
  label_id text not null references labels(id) on delete cascade,
  primary key (card_id, label_id)
);
create table if not exists card_assignees (
  card_id text not null references cards(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  primary key (card_id, user_id)
);
create table if not exists comments (
  id text primary key,
  card_id text not null references cards(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  body text not null,
  created_at integer not null
);
create index if not exists idx_cards_board on cards(board_id);
create index if not exists idx_lists_board on lists(board_id);
create index if not exists idx_comments_card on comments(card_id);
`;

function open() {
  fs.mkdirSync(dataDir, { recursive: true });
  const db = new Database(path.join(dataDir, "taskboard.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(schema);
  return db;
}

// reuse one connection across hot reloads in dev
const g = globalThis as unknown as { __db?: Database.Database };
export const db = g.__db ?? (g.__db = open());

export const newId = () => crypto.randomUUID();
