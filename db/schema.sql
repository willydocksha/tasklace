-- tasklace schema for postgres (supabase). safe to run more than once.
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
  role text not null default 'viewer',
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

-- card history: status moves and field edits, newest read first
create table if not exists card_activity (
  id text primary key,
  card_id text not null references cards(id) on delete cascade,
  user_id text references users(id) on delete set null,
  kind text not null,
  data jsonb not null default '{}',
  created_at bigint not null
);

-- sprints (jira-style): planned -> active -> completed
create table if not exists sprints (
  id text primary key,
  board_id text not null references boards(id) on delete cascade,
  name text not null,
  goal text not null default '',
  start_date text,
  end_date text,
  status text not null default 'planned',
  created_at bigint not null
);

-- issue keys (TLC-12), story points, sprint membership
alter table boards add column if not exists key text;
alter table boards add column if not exists next_number integer not null default 1;
alter table cards add column if not exists number integer;
alter table cards add column if not exists points integer;
alter table cards add column if not exists sprint_id text references sprints(id) on delete set null;

-- backfill keys and numbers for rows created before these columns existed
update boards set key = coalesce(nullif(upper(substr(regexp_replace(name, '[^A-Za-z]', '', 'g'), 1, 3)), ''), 'TL') where key is null;
update cards c set number = r.n
  from (select id, row_number() over (partition by board_id order by created_at, id) as n from cards) r
  where r.id = c.id and c.number is null;
update boards b set next_number = m.n + 1
  from (select board_id, max(number) as n from cards group by board_id) m
  where m.board_id = b.id and b.next_number <= m.n;

-- teams: a group of people sharing a set of boards (a board can be in many teams)
create table if not exists teams (
  id text primary key,
  name text not null,
  invite_code text not null unique,
  owner_id text not null references users(id),
  created_at bigint not null
);

create table if not exists team_members (
  team_id text not null references teams(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  role text not null default 'viewer',
  primary key (team_id, user_id)
);

create table if not exists team_boards (
  team_id text not null references teams(id) on delete cascade,
  board_id text not null references boards(id) on delete cascade,
  primary key (team_id, board_id)
);

-- who can open a board: direct board members plus members of every team the board is in.
-- team owners/admins act as board admins, team viewers stay viewers; team_id points at the
-- team's permission policy (null for direct members). security_invoker keeps it behind the tables' rls.
create or replace view board_access with (security_invoker = true) as
  select board_id, user_id, role, true as direct, null::text as team_id from board_members
  union all
  select tb.board_id, tm.user_id,
    case when tm.role in ('owner', 'admin') then 'admin' when tm.role = 'viewer' then 'viewer' else 'member' end,
    false, tm.team_id
  from team_boards tb join team_members tm on tm.team_id = tb.team_id;

-- email verification: accounts created before this existed count as verified
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name = 'users' and column_name = 'email_verified_at') then
    alter table users add column email_verified_at bigint;
    update users set email_verified_at = created_at;
  end if;
end $$;
-- accounts made through github/google may have no password
alter table users alter column password_hash drop not null;

-- one-time email links; only a sha-256 of the token is stored
create table if not exists email_tokens (
  token_hash text primary key,
  user_id text not null references users(id) on delete cascade,
  purpose text not null,
  next text,
  expires_at bigint not null,
  created_at bigint not null
);

-- profile: unique handle, photo url (own upload or provider picture)
alter table users add column if not exists username text;
alter table users add column if not exists avatar_url text;

-- optional list color (hex) for tinting kanban columns
alter table lists add column if not exists color text;

create unique index if not exists idx_users_username on users(lower(username));

-- uploaded profile photos (small, resized in the browser)
create table if not exists user_avatars (
  user_id text primary key references users(id) on delete cascade,
  mime text not null,
  data bytea not null,
  updated_at bigint not null
);

-- extra payload for a token (e.g. the new address of an email change)
alter table email_tokens add column if not exists data text;

-- github / google identities linked to a user
create table if not exists oauth_accounts (
  provider text not null,
  provider_user_id text not null,
  user_id text not null references users(id) on delete cascade,
  created_at bigint not null,
  primary key (provider, provider_user_id)
);

create index if not exists idx_sessions_user on sessions(user_id);
create index if not exists idx_members_user on board_members(user_id);
create index if not exists idx_cards_board on cards(board_id);
create index if not exists idx_cards_list on cards(list_id);
create index if not exists idx_lists_board on lists(board_id);
create index if not exists idx_labels_board on labels(board_id);
create index if not exists idx_comments_card on comments(card_id);
create index if not exists idx_activity_card on card_activity(card_id, created_at);
create index if not exists idx_sprints_board on sprints(board_id);
create unique index if not exists idx_cards_number on cards(board_id, number);
create index if not exists idx_team_members_user on team_members(user_id);
create index if not exists idx_team_boards_board on team_boards(board_id);
create index if not exists idx_email_tokens_user on email_tokens(user_id);
create index if not exists idx_oauth_user on oauth_accounts(user_id);

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
alter table card_activity enable row level security;
alter table sprints enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table team_boards enable row level security;
alter table email_tokens enable row level security;
alter table oauth_accounts enable row level security;
alter table user_avatars enable row level security;

-- the view is never needed through supabase's rest api
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on board_access from anon, authenticated;
  end if;
end $$;

-- images attached to a card (compressed in the browser), plus a small thumbnail
create table if not exists card_attachments (
  id text primary key,
  card_id text not null references cards(id) on delete cascade,
  user_id text references users(id) on delete set null,
  name text not null,
  mime text not null,
  width int not null,
  height int not null,
  size int not null,
  data bytea not null,
  thumb bytea not null,
  created_at bigint not null
);
create index if not exists idx_card_attachments_card on card_attachments(card_id);

-- status flow: lists a card in this list may move to (null = any list)
alter table lists add column if not exists next_ids text[];

-- plain-text subtasks of a card, each with its own status (a list of the board; null = first list)
create table if not exists card_subtasks (
  id text primary key,
  card_id text not null references cards(id) on delete cascade,
  title text not null,
  list_id text references lists(id) on delete set null,
  position integer not null,
  created_at bigint not null
);
create index if not exists idx_card_subtasks_card on card_subtasks(card_id);
alter table card_subtasks enable row level security;

-- people responsible for a subtask (one or more)
create table if not exists card_subtask_assignees (
  subtask_id text not null references card_subtasks(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  primary key (subtask_id, user_id)
);
alter table card_subtask_assignees enable row level security;

-- team photo (small, cropped and compressed in the browser)
alter table teams add column if not exists avatar_url text;
create table if not exists team_avatars (
  team_id text primary key references teams(id) on delete cascade,
  mime text not null,
  data bytea not null,
  updated_at bigint not null
);
alter table team_avatars enable row level security;

-- team permission policy (see src/lib/permissions.ts); missing keys use the defaults
alter table teams add column if not exists permissions jsonb not null default '{}';

-- each user's own order of the boards page (dragged by hand; new boards have no row)
create table if not exists board_positions (
  user_id text not null references users(id) on delete cascade,
  board_id text not null references boards(id) on delete cascade,
  position integer not null,
  primary key (user_id, board_id)
);
alter table board_positions enable row level security;

-- onboarding tours a user has finished or skipped
alter table users add column if not exists tours_seen text[] not null default '{}';

-- board look: background (null = gradient color, "p:<preset>" = built-in scene, "u:<time>" = uploaded photo) and icon
alter table boards add column if not exists background text;
alter table boards add column if not exists icon text;
-- uploaded board background (compressed in the browser), plus a small thumbnail for tiles and menus
create table if not exists board_backgrounds (
  board_id text primary key references boards(id) on delete cascade,
  mime text not null,
  data bytea not null,
  thumb bytea not null,
  updated_at bigint not null
);
alter table board_backgrounds enable row level security;

-- subtask flow: which lists subtasks may use, and an optional flow of their own
alter table lists add column if not exists subtask boolean not null default true;
alter table lists add column if not exists subtask_next_ids text[];
-- false = subtasks follow the card flow (limited to subtask lists), true = lists.subtask_next_ids
alter table boards add column if not exists subtask_own_flow boolean not null default false;

-- team workflows: one set of statuses + card/subtask flow, synced to every linked board.
-- statuses is [{key, name, color, is_done, subtask, next: key[] | null, subtask_next: key[] | null}]
create table if not exists workflows (
  id text primary key,
  team_id text not null references teams(id) on delete cascade,
  name text not null,
  statuses jsonb not null default '[]',
  subtask_own_flow boolean not null default false,
  created_at bigint not null,
  updated_at bigint not null
);
create index if not exists idx_workflows_team on workflows(team_id);
alter table workflows enable row level security;
-- a board follows at most one workflow; each of its lists remembers which status it is
alter table boards add column if not exists workflow_id text references workflows(id) on delete set null;
alter table lists add column if not exists workflow_key text;

-- images live in supabase storage: path = object key (thumbnail at path || '.thumb').
-- data/thumb only hold bytes on rows from before the move (or when storage is not configured).
alter table user_avatars add column if not exists path text;
alter table user_avatars alter column data drop not null;
alter table team_avatars add column if not exists path text;
alter table team_avatars alter column data drop not null;
alter table board_backgrounds add column if not exists path text;
alter table board_backgrounds alter column data drop not null;
alter table board_backgrounds alter column thumb drop not null;
alter table card_attachments add column if not exists path text;
alter table card_attachments alter column data drop not null;
alter table card_attachments alter column thumb drop not null;

-- storage objects whose row is gone or replaced; the app deletes them from the bucket (src/lib/storage.ts)
create table if not exists storage_trash (
  path text primary key,
  created_at bigint not null
);
alter table storage_trash enable row level security;

-- queue the old file when an image row is deleted (also by cascade) or points to a new file
create or replace function trash_stored_file() returns trigger language plpgsql as $$
declare
  now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if old.path is null then return null; end if;
  if tg_op = 'UPDATE' then
    if new.path is not distinct from old.path then return null; end if;
  end if;
  insert into storage_trash (path, created_at) values (old.path, now_ms) on conflict do nothing;
  if tg_table_name in ('card_attachments', 'board_backgrounds') then
    insert into storage_trash (path, created_at) values (old.path || '.thumb', now_ms) on conflict do nothing;
  end if;
  return null;
end $$;
drop trigger if exists trash_file on user_avatars;
create trigger trash_file after delete or update of path on user_avatars for each row execute function trash_stored_file();
drop trigger if exists trash_file on team_avatars;
create trigger trash_file after delete or update of path on team_avatars for each row execute function trash_stored_file();
drop trigger if exists trash_file on board_backgrounds;
create trigger trash_file after delete or update of path on board_backgrounds for each row execute function trash_stored_file();
drop trigger if exists trash_file on card_attachments;
create trigger trash_file after delete or update of path on card_attachments for each row execute function trash_stored_file();
