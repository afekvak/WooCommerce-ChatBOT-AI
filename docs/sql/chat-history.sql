-- Initial setup for a new database. Already applied to the connected project.
begin;
create table public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  client_id bigint not null references public.users(id) on delete cascade,
  session_id text not null check (length(session_id) between 1 and 128),
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, session_id)
);
create index chat_conversations_client_updated_idx on public.chat_conversations (client_id, updated_at desc, id);
create table public.chat_messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null references public.chat_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index chat_messages_conversation_id_idx on public.chat_messages (conversation_id, id desc);
alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;
revoke all on public.chat_conversations, public.chat_messages from anon, authenticated;
revoke all on sequence public.chat_messages_id_seq from anon, authenticated;
commit;
