# Persistent chat history setup

## Database setup

Applied on 2026-10-23 to Supabase project `pbzfcvisclqizmtrirdc` using the connected
Supabase integration. Both tables and their RLS/grants were verified after
creation. Do not run the creation SQL again on that project.

For a new database, in its Supabase SQL Editor run all of
`docs/sql/chat-history.sql` once. This creates:

- `chat_conversations`: each conversation belongs to `public.users.id` (bigint).
- `chat_messages`: ordered user/assistant messages belonging to a conversation.

The SQL includes indexes, foreign keys, RLS, and removal of browser API grants.
It does not change existing tables. The backend's `DATABASE_URL` must connect
as postgres or another deliberately configured privileged backend role. There
are no public Data API policies: your application uses its existing client-key
lookup and enforces ownership on every chat history query.

The final SELECT verifies that both tables exist with RLS enabled. This SQL was
tested against temporary tables on PostgreSQL, then rolled back, before the
permanent tables were created in the project listed above.

Restart the backend with `npm run dev`. When using WordPress, replace the
installed plugin's widget runtime with the updated `plugin-build` assets (or
repackage/reinstall the plugin). Both runtime copies in this repository match.

## Behavior

On widget load, `/conversations` opens or resumes the client's browser session.
The returned conversation UUID is saved locally; the messages themselves are
loaded from PostgreSQL. The browser no longer treats its old local message cache
as the source of truth. Old browser-only chats are not imported.

Every message and assistant reply is saved before its request finishes. API
errors can leave an unanswered user message; retrying creates another user
message. This feature does not promise exactly-once WooCommerce writes.

Recent messages are provided to native tool calling along with summaries and
relevant store memory; see `docs/memory.md` for context budgets. All messages
remain stored; the widget loads the latest 100. Earlier pages are available
through the API. The New chat button starts another conversation without
deleting the current one.

The trash button deletes the current conversation's saved messages on the
server and clears its wizard state. It no longer just hides the browser history.
Past confirmation cards do not reopen action dialogs when replayed.

## Endpoints

All requests require the existing client key (POST body `clientKey`, or
`x-mcp-client-key` header). Never supply a client/user ID to claim ownership.

- `POST /conversations`: `{ sessionId }` opens a browser conversation;
  `{ conversationId }` resumes an owned one. Returns conversation + recent messages.
- `GET /conversations`: latest 50 conversations for the authenticated client.
- `GET /conversations/:id/messages`: latest 100 messages in chronological order.
  Use `?before=<oldest-message-id>` for an older page.
- `POST /conversations/:id/clear`: deletes the conversation's messages.
- `POST /chat`: existing message/clientKey/sessionId fields plus optional
  `conversationId`; returns that ID alongside the existing reply fields.

The widget resumes the same conversation in the same browser. Listing/switching
older conversations on other devices is available through the API; a history
picker has not been added to the widget yet.

## Boundaries

This is store-level history because a client key identifies a store, not an
individual WordPress staff member. Anyone with that key can read its chats.
Private staff history needs verified staff identities first.

Summaries and memory across conversations are now implemented; see
`docs/memory.md`. This does not add embeddings or model training. Tool output is
currently stored as assistant text/cards, not structured tool-call audit events.

Wizard state remains in memory and is lost on server restart. Reopen the desired
workflow after restarting. Only one Node process is supported for active wizard
conversations; turns and clears serialize within that process. Distributed
locking and persisted pending actions are a separate step.

## Checks

```powershell
node node_modules/typescript/bin/tsc --noEmit
node --import tsx --test tests/conversations.test.ts tests/toolRegistry.test.ts tests/productService.test.ts
```

Optional real PostgreSQL integration test (reads `.env`, creates only temporary
tables on one connection, rolls back at the end):

```powershell
$env:RUN_CHAT_DB_TESTS = '1'
node --import tsx --test tests/conversations.test.ts
```
