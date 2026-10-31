import type { Pool } from "pg";
import { ConversationStore, type StoredMessage } from "./conversations";

export interface SavedMemory { memory_key: string; content: string; updated_at: string }
export interface Summary { content: string; through_message_id: string }
export interface HistoryMatch { conversation_id: string; title: string; content: string; created_at: string; kind: string }

/** All memory access is scoped by a server-resolved store/client ID. */
export class MemoryStore {
  readonly conversations: ConversationStore;
  constructor(private readonly db: Pick<Pool, "query">) {
    this.conversations = new ConversationStore(db);
  }

  async list(clientId: string): Promise<SavedMemory[]> {
    const { rows } = await this.db.query(
      `select memory_key, content, updated_at from public.chat_memories
       where client_id = $1 order by updated_at desc, memory_key limit 100`, [clientId]
    );
    return rows;
  }

  async remember(clientId: string, conversationId: string, sourceId: string, key: string, content: string) {
    const { rows } = await this.db.query(
      `insert into public.chat_memories (client_id, memory_key, content, source_message_id)
       select c.client_id, $4, $5, m.id from public.chat_conversations c
       join public.chat_messages m on m.conversation_id = c.id
       where c.client_id = $1 and c.id = $2 and m.id = $3 and m.role = 'user'
         and position($5 in m.content) > 0
       on conflict (client_id, memory_key) do update
         set content = excluded.content, source_message_id = excluded.source_message_id, updated_at = now()
       returning memory_key`, [clientId, conversationId, sourceId, key, content]
    );
    if (!rows.length) throw new Error("Memory must quote a message from this client's conversation");
  }

  async forget(clientId: string, key: string): Promise<boolean> {
    const result = await this.db.query(
      `delete from public.chat_memories where client_id = $1 and memory_key = $2`, [clientId, key]
    );
    return !!result.rowCount;
  }

  async summary(clientId: string, conversationId: string): Promise<Summary | undefined> {
    await this.conversations.requireOwned(clientId, conversationId);
    const { rows } = await this.db.query(
      `select s.content, s.through_message_id::text from public.chat_summaries s
       join public.chat_conversations c on c.id = s.conversation_id
       where c.client_id = $1 and c.id = $2`, [clientId, conversationId]
    );
    return rows[0];
  }

  async summaryBatch(clientId: string, conversationId: string, after = "0"): Promise<StoredMessage[]> {
    await this.conversations.requireOwned(clientId, conversationId);
    const { rows } = await this.db.query(
      `with boundary as (
         select m.id from public.chat_messages m join public.chat_conversations c on c.id=m.conversation_id
         where c.client_id=$1 and c.id=$2 order by m.id desc offset 19 limit 1
       ) select m.id::text, m.role, m.content, m.created_at from public.chat_messages m
       join public.chat_conversations c on c.id=m.conversation_id
       where c.client_id=$1 and c.id=$2 and m.id>$3::bigint and m.id<(select id from boundary)
       order by m.id limit 40`, [clientId, conversationId, after]
    );
    return rows;
  }

  async saveSummary(clientId: string, conversationId: string, throughId: string, content: string, expectedPrevious = "0") {
    // Verify source ownership and use a watermark comparison to avoid overwriting a newer summary.
    await this.db.query(
      `insert into public.chat_summaries (conversation_id, through_message_id, content)
       select c.id, m.id, $4 from public.chat_conversations c
       join public.chat_messages m on m.conversation_id=c.id
       where c.client_id=$1 and c.id=$2 and m.id=$3
       on conflict (conversation_id) do update set through_message_id=excluded.through_message_id,
         content=excluded.content, updated_at=now()
       where chat_summaries.through_message_id=$5::bigint
         and chat_summaries.through_message_id<excluded.through_message_id`,
      [clientId, conversationId, throughId, content, expectedPrevious]
    );
  }

  async search(clientId: string, currentId: string | null, query: string, excludeMessageId = "0"): Promise<HistoryMatch[]> {
    // OR terms tolerate conversational phrasing; 'simple' also tokenizes Hebrew.
    const stop = new Set(["what", "did", "the", "and", "about", "with", "from", "that", "this", "chat", "previous", "remember", "please"]);
    const terms = [...new Set((query.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) || []).filter(word => !stop.has(word)))].slice(0, 12);
    if (!terms.length) {
      const { rows } = await this.db.query(
        `select c.id as conversation_id, c.title, left(coalesce(s.content, m.content), 12000) as content,
           c.updated_at as created_at, case when s.content is null then 'message' else 'summary' end as kind
         from public.chat_conversations c left join public.chat_summaries s on s.conversation_id=c.id
         join lateral (
           select string_agg(left(content, 1600), E'\n' order by id) as content from (
             (select id, content from public.chat_messages where conversation_id=c.id and id<>$3::bigint order by id limit 4)
             union
             (select id, content from public.chat_messages where conversation_id=c.id and id<>$3::bigint order by id desc limit 6)
           ) recent
         ) m on m.content is not null
         where c.client_id=$1 and ($2::uuid is null or c.id<>$2) order by c.updated_at desc limit 5`, [clientId, currentId, excludeMessageId]
      );
      return rows;
    }
    const { rows } = await this.db.query(
      `with q as (select websearch_to_tsquery('simple', $3) as terms), matches as (
         select c.id as conversation_id, c.title, left(m.content,12000) as content, m.created_at,
           'message' as kind, ts_rank(to_tsvector('simple',m.content),q.terms) as rank
         from public.chat_messages m join public.chat_conversations c on c.id=m.conversation_id cross join q
         where c.client_id=$1 and ($2::uuid is null or c.id<>$2) and m.id<>$4::bigint and to_tsvector('simple',m.content) @@ q.terms
         union all
         select c.id,c.title,left(s.content,1600),s.updated_at,'summary',ts_rank(to_tsvector('simple',s.content),q.terms)
         from public.chat_summaries s join public.chat_conversations c on c.id=s.conversation_id cross join q
         where c.client_id=$1 and ($2::uuid is null or c.id<>$2) and to_tsvector('simple',s.content) @@ q.terms
       ) select conversation_id,title,content,created_at,kind from (
         select matches.*, row_number() over (partition by conversation_id order by rank desc,created_at desc) as rn
         from matches
       ) ranked where rn=1 order by rank desc,created_at desc limit 5`, [clientId, currentId, terms.join(" OR "), excludeMessageId]
    );
    return rows;
  }
}
