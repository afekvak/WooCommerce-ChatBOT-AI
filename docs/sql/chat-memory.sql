-- Apply after chat-history.sql. No existing messages are rewritten.
begin;
create table public.chat_summaries (
  conversation_id uuid primary key references public.chat_conversations(id) on delete cascade,
  through_message_id bigint not null references public.chat_messages(id) on delete cascade,
  content text not null check (length(content) between 1 and 4000),
  updated_at timestamptz not null default now()
);
create table public.chat_memories (
  id uuid primary key default gen_random_uuid(),
  client_id bigint not null references public.users(id) on delete cascade,
  memory_key text not null check (memory_key ~ '^[a-z][a-z0-9_]{0,63}$'),
  content text not null check (length(content) between 1 and 600),
  source_message_id bigint not null references public.chat_messages(id) on delete cascade,
  updated_at timestamptz not null default now(),
  unique (client_id, memory_key)
);
create index chat_memories_client_updated_idx on public.chat_memories (client_id, updated_at desc);
create index chat_memories_source_idx on public.chat_memories (source_message_id);
create index chat_summaries_source_idx on public.chat_summaries (through_message_id);
create index chat_messages_search_idx on public.chat_messages using gin (to_tsvector('simple', content));
create index chat_summaries_search_idx on public.chat_summaries using gin (to_tsvector('simple', content));
alter table public.chat_summaries enable row level security;
alter table public.chat_memories enable row level security;
revoke all on public.chat_summaries, public.chat_memories from anon, authenticated;
commit;
