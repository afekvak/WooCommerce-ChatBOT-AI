import type { Pool } from "pg";

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export class ConversationNotFound extends Error {}

/** All entry points enforce ownership using the resolved client ID, never the request body. */
export class ConversationStore {
  constructor(private readonly db: Pick<Pool, "query">) {}

  async open(clientId: string, sessionId: string, conversationId?: string): Promise<Conversation> {
    if (conversationId) return this.requireOwned(clientId, conversationId);
    const { rows } = await this.db.query(
      `insert into public.chat_conversations (client_id, session_id)
       values ($1, $2) on conflict (client_id, session_id)
       do update set session_id = excluded.session_id
       returning id, title, created_at, updated_at`, [clientId, sessionId]
    );
    return rows[0];
  }

  async requireOwned(clientId: string, id: string): Promise<Conversation> {
    const { rows } = await this.db.query(
      `select id, title, created_at, updated_at from public.chat_conversations
       where client_id = $1 and id = $2`, [clientId, id]
    );
    if (!rows[0]) throw new ConversationNotFound("Conversation not found");
    return rows[0];
  }

  async list(clientId: string): Promise<Conversation[]> {
    const { rows } = await this.db.query(
      `select id, title, created_at, updated_at from public.chat_conversations
       where client_id = $1 order by updated_at desc, id`, [clientId]
    );
    return rows;
  }

  async messages(clientId: string, id: string, limit = 100, before?: string): Promise<StoredMessage[]> {
    await this.requireOwned(clientId, id);
    const { rows } = await this.db.query(
      `select m.id::text, m.role, m.content, m.created_at
       from public.chat_messages m
       join public.chat_conversations c on c.id = m.conversation_id
       where c.client_id = $1 and c.id = $2
         and ($3::bigint is null or m.id < $3::bigint)
       order by m.id desc limit $4`, [clientId, id, before || null, Math.max(1, Math.min(100, limit))]
    );
    return rows.reverse();
  }

  async append(clientId: string, id: string, role: StoredMessage["role"], content: string) {
    const { rows } = await this.db.query(
      `with owned as (
         update public.chat_conversations set updated_at = now(),
           title = case when title = 'New conversation' and $3 = 'user'
                        then left($4, 80) else title end
         where client_id = $1 and id = $2 returning id
       ) insert into public.chat_messages (conversation_id, role, content)
         select id, $3, $4 from owned returning id::text`, [clientId, id, role, content]
    );
    if (!rows[0]) throw new ConversationNotFound("Conversation not found");
    return rows[0].id as string;
  }

  async delete(clientId: string, id: string) {
    const { rows } = await this.db.query('delete from public.chat_conversations where client_id = $1 and id = $2 returning id', [clientId, id]);
    if (!rows[0]) throw new ConversationNotFound("Conversation not found");
  }
  async clear(clientId: string, id: string) {
    const { rows } = await this.db.query(
      `with owned as (
         update public.chat_conversations set title = 'New conversation', updated_at = now()
         where client_id = $1 and id = $2 returning id
       ), removed as (
         delete from public.chat_messages where conversation_id in (select id from owned)
       ) select id from owned`, [clientId, id]
    );
    if (!rows[0]) throw new ConversationNotFound("Conversation not found");
  }
}

// Serialize turns/clears in this Node process. Wizard state already requires one process.
const turns = new Map<string, Promise<unknown>>();
export async function withConversationTurn<T>(key: string, action: () => Promise<T>): Promise<T> {
  const previous = turns.get(key) || Promise.resolve();
  const current = previous.catch(() => {}).then(action);
  turns.set(key, current);
  try { return await current; }
  finally { if (turns.get(key) === current) turns.delete(key); }
}
