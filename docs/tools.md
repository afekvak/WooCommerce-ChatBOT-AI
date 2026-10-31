# How tools are registered and executed

`src/mcp/tools/registry.ts` owns the tool definitions for each server.
Each definition contains a name, description, Zod input schema, and handler.

1. `setupAllTools(server)` registers WooCommerce tools, the date tool, and conversation workflows.
2. `registerTool(server, name, metadata, handler)` exposes a definition to MCP
   and records it in the shared registry. It does not patch the SDK.
3. The chat router continues active workflows or calls `runToolConversation`.
   This loop uses `executeTool(server, name, args, toolCtx)` for AI-selected tools.
4. The executor validates the arguments before invoking the handler.
5. MCP calls use the same executor. MCP transport metadata is not passed as
   application client context; existing credential arguments/fallbacks remain.

`listTools(server)` supplies descriptions and schemas for native AI tool calling.
Do not create another list of tool definitions or call handlers
directly from new chat routing code.

## Adding a tool

Define the schema and handler, then call `registerTool` from the appropriate
setup function. Do not separately assign to a registry or `server.tools`.
Tools are hidden from AI chat by default. Set `chat: {}` only for safe read tools.
Use `registerChatTool` with `chat: { terminal: true }` for a conversation workflow
that prepares a confirmation or asks for fields. These workflows use a backend
session and are not exposed as standalone MCP tools.
Prefer adding parameters to an existing capability when the operation is the
same (for example, updating a name or price uses the same update tool).

## Current boundaries

The manual `intentAnalyzer.ts` and `quickRules.ts` have been removed. The same
AI request can answer a question, ask for clarification, or call a tool. Read
results are sent back to the model so it can choose a subsequent tool.

The loop runs at most four tools, followed by a final response. It rejects
unadvertised tools, malformed inputs, credential overrides, multiple concurrent
actions, and repeated identical calls. Store credentials come from client context.
Model-authored text is HTML-escaped; existing read-result cards still render.

Chat can read store information or prepare create/update/bulk-update workflows.
The raw create/update MCP tools and plain LLM MCP tool are hidden from AI chat.
Preparation ends the AI loop and displays the workflow's authoritative reply;
only a later confirmation handled by the active wizard can apply changes.
Single-product preparation accepts validated changes and goes straight to a
preview when sufficient information is provided. Cancellation discards them.

MCP retains its existing direct CRUD behavior and credential arguments. The
generic executor validates input; chat exposure and wizard confirmation are
separate controls. Wizards execute confirmed writes through the product service.

## Product service

`src/services/productService.ts` now owns all implemented product API calls,
including category/tag lookups and batch updates. Tools and wizards import
this service directly. The old CRUD controller modules re-export service
functions for compatibility; they contain no API logic.

`ProductService` accepts a small API interface for testing.
`createProductService(url, ck, cs)` constructs one for a real store. Its methods
return data rather than HTML. Existing tools still format that data for the
widget, while wizards retain their questions and confirmation steps.

Product IDs now require positive whole numbers (strings such as `12junk`
are rejected). List limits are normalized to 1–100. Bulk update counts use
successful item results rather than the number of requested writes. API errors
include operation context without logging the full creation payload.

Persistent conversations, native AI tool calling, summaries, and store memory
are implemented. See `docs/chat-history.md` and `docs/memory.md` for database
setup. Memory tools share the registry and are exposed only to authenticated
chat sessions: `remember_store_fact`, `list_store_memories`, `forget_store_fact`,
and `search_chat_history`. They do not bypass store-operation confirmation.

## AI configuration

`src/mcp/llm/client.ts` is the shared OpenAI client. Both chat and the standalone
LLM MCP tool use `OPENAI_API_KEY`, optional `OPENAI_BASE_URL`, and `LLM_MODEL`.
This implementation keeps the existing Chat Completions API and configured model.
Tool definitions are generated with the installed OpenAI SDK's Zod helper.
Optional fields are nullable in the advertised schema and normalized back to
omitted values before backend validation. Provider strict mode is disabled for
provider compatibility; backend Zod validation is mandatory.

Provider/model combinations must support native Chat Completions function tools.
There is no fallback to guessing JSON tool names when tool calling is unsupported.
Read results currently use formatted HTML, and tool-call/result events are not
yet persisted separately from the final assistant text/cards.

## Verification

```powershell
node node_modules/typescript/bin/tsc --noEmit
node --import tsx --test tests/toolRegistry.test.ts tests/productService.test.ts tests/toolCalling.test.ts tests/conversations.test.ts
```

The tests exercise chat validation and context forwarding, registry isolation,
duplicate definitions, actual MCP discovery, and MCP tool execution without
calling OpenAI, a database, or a live WooCommerce store. Service tests also cover
SKU resolution, category lookups, pagination filters, create/update payloads,
invalid identifiers, batch item failures, and API errors using a fake transport.
Native routing tests use mock model responses, the real OpenAI SDK against a
localhost mock, and a localhost WooCommerce mock. They verify discovery, context,
schema validation, hidden write tools, bounded execution, creation/bulk previews,
and that only a later confirmed turn writes the exact prepared product payload.
Cancellation issues no write. Live OpenAI responses and live store writes are
not exercised. The opt-in PostgreSQL test is described in `chat-history.md`.

## Expanded product management

See [product-management.md](product-management.md) for the shared catalog CRUD/batch tools, product field coverage, image operations, confirmation guarantees and store/version limitations. Resource schemas are defined in `src/services/catalogService.ts` and `src/services/productSchema.ts`; tool definitions are generated from those schemas rather than duplicated by field.
