# Summaries and memory across chats

## Database

`docs/sql/chat-memory.sql` was applied to Supabase project
`pbzfcvisclqizmtrirdc` on 2026-10-23, after temporary-table integration tests.
Both tables have RLS enabled and no anon/authenticated Data API grants.
The backend uses its existing privileged PostgreSQL connection and explicitly
checks the authenticated client ID in every query. Do not rerun the creation SQL
on this project. Run it after `chat-history.sql` when setting up a new database.

- `chat_summaries`: one incremental summary per conversation, with a source
  message watermark and a timestamp.
- `chat_memories`: explicitly saved facts/preferences by client and stable key,
  linked to the exact source user message. Reusing a key replaces its value.
- Full-text indexes support keyword search over summaries and original messages.

## What the user can do

- Say **Remember that I prefer draft products** to save a fact for future chats.
- Say **What do you remember about my store?** to inspect saved facts and keys.
- Say **Forget my publishing preference** to remove a particular saved fact.
- Say **Find our earlier discussion about summer shirts** to search old chats.
- Click **＋ (New chat)** to start a separate conversation while retaining the
  previous conversation and its saved facts. Reload resumes the new conversation.

The model selects the tools using their descriptions. Saving additionally
requires a current explicit remember/save request and an exact quote from that
message. Facts inferred by the model or found in old product descriptions cannot
be silently saved. Common credential patterns are rejected/redacted.

This is store/client-key memory, shared by staff using that key. It does not add
personal staff authentication or train the model.

## Context and summaries

`ConversationMemory.context()` runs before a new native-tool conversation:

1. Load the current summary and messages not yet summarized, excluding the most
   recent 20 messages.
2. When at least 10 older messages accumulate, summarize up to 40 in one model
   request and advance the watermark. Older unsummarized messages remain stored;
   large archives catch up over subsequent requests and can be searched directly.
3. Include the most recent messages and pending tail within a 16,000-character
   budget, the summary (up to 3,000 characters), up to 10 saved facts, and up to
   three relevant historical excerpts.

If a broad question has no keyword matches, recent discussions are supplied as
a fallback, including short chats without saved facts or summaries. Recent
discussion excerpts include opening messages as well as the latest messages,
so an old product request is not lost behind a closing acknowledgement.
An empty saved-facts list must not be described as having no chat history.
Memory searches omit the current question to avoid returning it as evidence.
Recall context uses topics, dates and excerpts; conversation UUIDs stay internal.
Memory search/list results are sent to the model for a readable reply and are
not copied into the widget as raw JSON cards.
The memory overview tool returns saved facts and recent discussion excerpts
together, so even when the model chooses this tool it sees earlier discussions
rather than interpreting an empty facts list as complete amnesia.

The summary model is the configured `LLM_MODEL`; it has no action tools. It gets
cleaned, bounded excerpts rather than widget HTML/styles/confirmation metadata.
Summary generation has a 15-second timeout and no retries. If it fails, chat
continues with recent history; the next request can retry. Each refresh adds an
AI request, not a request for every stored message or every new conversation.

Historical references are explicitly labelled as untrusted data, not a new user
request or approval. Current requests override older preferences. Product prices,
stock, and availability require fresh WooCommerce reads. Proposed actions are
not recorded as completed actions merely because they were discussed.

## Removal

Forgetting a fact deletes its saved-memory row. Original chat messages remain
until their conversation is cleared, so the assistant can still search past
discussions when explicitly asked. Historical excerpts are not authoritative
saved preferences and must not silently restore a forgotten preference.

The trash button deletes the current conversation's messages. Database foreign
keys also delete summaries and saved facts sourced from those messages. Clearing
one conversation does not delete other conversations. Starting a new chat deletes
nothing. An updated fact belongs to its latest source message.

## Boundaries and verification

Search is PostgreSQL keyword retrieval (including simple tokenization for Hebrew),
not embedding-based semantic retrieval. Summary text is model-generated and can
omit or misstate details; original messages remain available through search.
Saved preferences are requested explicitly rather than extracted automatically.
Pending store-operation state still lives in memory and cannot survive restarts.

```powershell
node node_modules/typescript/bin/tsc --noEmit
node --import tsx --test tests/memory.test.ts tests/toolCalling.test.ts tests/toolRegistry.test.ts tests/productService.test.ts tests/conversations.test.ts
```

For the opt-in PostgreSQL tests, set `RUN_CHAT_DB_TESTS=1`. They create temporary
tables on a single connection per test and roll back, without modifying live chats.
Tests use mock summaries and local AI/WooCommerce mocks, not paid live AI calls.
Browser tests exercise New chat, reload, error recovery and clearing with fake
conversations in headless Chrome on localhost, at desktop and mobile sizes.
