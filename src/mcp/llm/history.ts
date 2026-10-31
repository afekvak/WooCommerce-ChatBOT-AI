// src/mcp/llm/history.ts
import type { ChatCompletionMessageParam } from "openai/resources/chat";
import type { ConversationStore } from "../../db/conversations";

/** Request-owned adapter: no shared default history or browser-supplied client ID. */
export class ConversationHistory {
  constructor(
    private readonly store: ConversationStore,
    private readonly clientId: string,
    readonly conversationId: string
  ) {}

  append(role: "user" | "assistant", content: string) {
    return this.store.append(this.clientId, this.conversationId, role, content);
  }

  async recent(): Promise<ChatCompletionMessageParam[]> {
    const messages = await this.store.messages(this.clientId, this.conversationId, 20);
    // Limit model context, not stored history. Detailed cards remain intact in the DB.
    return messages.map(({ role, content }) => ({ role, content: content.slice(0, 8000) }));
  }
}
