-- rajutin schema for postgres (supabase). safe to run more than once.
-- timestamps are unix milliseconds (bigint) to match the app code.

create table if not exists users (
  id text primary key,
  name text not null,
  email text not null unique,
  password_hash text not null,
  color text not null,
  created_at bigint not null
);

create table if not exists sessions (
  token text primary key,
  user_id text not null references users(id) on delete cascade,
  expires_at bigint not null
);

create table if not exists boards (
  id text primary key,
  name text not null,
  description text not null default '',
  color text not null,
  invite_code text not null unique,
  owner_id text not null references users(id),
  created_at bigint not null
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
  created_by text references users(id) on delete set null,
  created_at bigint not null
);

create table if not exists labels (
  id text primary key,
  board_id text not null references boards(id) on delete cascade,
  name text not null,
  color text not null,
  seq bigint generated always as identity
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
  created_at bigint not null
);

create index if not exists idx_sessions_user on sessions(user_id);
create index if not exists idx_members_user on board_members(user_id);
create index if not exists idx_cards_board on cards(board_id);
create index if not exists idx_cards_list on cards(list_id);
create index if not exists idx_lists_board on lists(board_id);
create index if not exists idx_labels_board on labels(board_id);
create index if not exists idx_comments_card on comments(card_id);

-- lock tables away from supabase's public rest api (anon key).
-- the app connects as the postgres role, which bypasses rls.
alter table users enable row level security;
alter table sessions enable row level security;
alter table boards enable row level security;
alter table board_members enable row level security;
alter table lists enable row level security;
alter table cards enable row level security;
alter table labels enable row level security;
alter table card_labels enable row level security;
alter table card_assignees enable row level security;
alter table comments enable row level security;
