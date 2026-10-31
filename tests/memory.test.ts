import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { parse } from "dotenv";
import { Pool } from "pg";
import { MemoryStore, type Summary } from "../src/db/memory";
import { ConversationMemory, cleanConversationText } from "../src/services/chatMemory";
import { ConversationStore } from "../src/db/conversations";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerMemoryTools } from "../src/mcp/tools/memoryTools";
import { executeTool } from "../src/mcp/tools/registry";

test("memory tools save, list and forget only through the request's bound memory session", async () => {
  const facts = new Map<string, string>();
  const store = {
    remember: async (_client: string, _chat: string, _source: string, key: string, content: string) => { facts.set(key, content); },
    list: async () => [...facts].map(([memory_key, content]) => ({ memory_key, content, updated_at: "now" })),
    forget: async (_client: string, key: string) => facts.delete(key),
    search: async () => [{ conversation_id: "f5921fcc-8ba8-4fa5-88f5-0e1033a0e4f8", title: "Earlier products", content: "add product", created_at: "2026-10-23", kind: "message" }]
  } as unknown as MemoryStore;
  const server = new McpServer({ name: "memory-test", version: "1.0.0" });
  registerMemoryTools(server);
  const context = (message: string) => ({
    client: { id: "1", clientKey: "test-only" }, sessionKey: "1:chat",
    memory: new ConversationMemory(store, "1", "chat", "1", message)
  });
  assert.equal((await executeTool(server, "remember_store_fact", { key: "language", content: "Use Hebrew" }, context("Remember: Use Hebrew"))).isError, false);
  const listed = await executeTool(server, "list_store_memories", {}, context("What do you remember?"));
  assert.match(listed.content[0].text, /Use Hebrew/);
  assert.match(listed.content[0].text, /recent_discussions.*add product/);
  assert.doesNotMatch(listed.content[0].text, /conversation_id|f5921fcc/);
  assert.equal((await executeTool(server, "forget_store_fact", { key: "language" }, context("Hello"))).isError, true);
  assert.equal(facts.size, 1);
  await executeTool(server, "forget_store_fact", { key: "language" }, context("Forget my language preference"));
  assert.equal(facts.size, 0);
  const withoutFacts = await executeTool(server, "list_store_memories", {}, context("What do you remember?"));
  assert.match(withoutFacts.content[0].text, /"saved_facts":\[\]/);
  assert.match(withoutFacts.content[0].text, /add product/);
  const found = await executeTool(server, "search_chat_history", { query: "add product" }, context("find the earlier discussion"));
  assert.match(found.content[0].text, /add product/);
  assert.doesNotMatch(found.content[0].text, /conversation_id|f5921fcc/);
});

test("memory writes require explicit permission and preserve user text when the model paraphrases", async () => {
  const writes: unknown[][] = [];
  const store = { remember: async (...args: unknown[]) => { writes.push(args); }, forget: async () => true } as unknown as MemoryStore;
  const current = "Remember that I prefer draft products";
  await new ConversationMemory(store, "1", "chat", "9", current).remember("publishing", "I prefer draft products");
  assert.deepEqual(writes, [["1", "chat", "9", "publishing", "I prefer draft products"]]);
  for (const request of ["What is my store name?", "Do not remember this", "Forget that I prefer draft products"]) {
    await assert.rejects(new ConversationMemory(store, "1", "chat", "9", request).remember("publishing", "draft"), /explicitly/);
  }
  await new ConversationMemory(store, "1", "chat", "9", current).remember("publishing", "Always publish immediately");
  assert.equal(writes[1][4], current);
  const original = "remember that i only add draft products";
  await new ConversationMemory(store, "1", "chat", "10", original).remember("publishing", "Only create products as drafts.");
  assert.equal(writes[2][4], original);
  await assert.rejects(new ConversationMemory(store, "1", "chat", "9", "Remember my password: abc").remember("password", "password: abc"), /credentials/);
  assert.equal(writes.length, 3);
  await assert.rejects(new ConversationMemory(store, "1", "chat", "9", "delete product 42").forget("publishing"), /explicitly/);
  assert.equal(await new ConversationMemory(store, "1", "chat", "9", "forget my publishing preference").forget("publishing"), true);
});

test("historical card markup, confirmation metadata and common API keys are removed from model context", () => {
  const text = cleanConversationText('<style>.hidden{}</style><script>bad()</script><div>Product #42</div> [[WIZARD_CONFIRM_META]]{"action":"update"}[[END_WIZARD_CONFIRM_META]] sk-testsecret123456');
  assert.match(text, /Product #42/);
  assert.doesNotMatch(text, /hidden|bad\(|WIZARD_CONFIRM|testsecret/);
});

test("a new chat recalls recent discussions even with no saved facts and no matching keywords", async () => {
  const queries: string[] = [];
  const id = "f5921fcc-8ba8-4fa5-88f5-0e1033a0e4f8";
  const store = {
    summary: async () => undefined, summaryBatch: async () => [], list: async () => [],
    conversations: { messages: async () => [{ role: "user", content: "what do you remember about my store" }] },
    search: async (_client: string, excluded: string, query: string, source: string) => {
      assert.equal(excluded, "new-chat"); assert.equal(source, "10"); queries.push(query);
      return query ? [] : [{ conversation_id: id, title: "Product discussion", content: "You asked to add a product", created_at: "2026-10-23", kind: "message" }];
    }
  } as unknown as MemoryStore;
  const context = await new ConversationMemory(store, "2", "new-chat", "10", "what do you remember about my store").context();
  assert.deepEqual(queries, ["what do you remember about my store", ""]);
  assert.match(context.reference, /asked to add a product/);
  assert.doesNotMatch(context.reference, /conversation_id|f5921fcc/);
  assert.deepEqual(JSON.parse(context.reference).explicitly_saved_facts, []);
});

test("summary refresh is incremental, context is bounded, and summary-provider errors do not block replies", async () => {
  let summary: Summary | undefined;
  let calls = 0;
  let fail = false;
  const pending = Array.from({ length: 10 }, (_, i) => ({ id: String(i + 1), role: "user" as const, content: `Older message ${i}`, created_at: "now" }));
  const recent = Array.from({ length: 20 }, (_, i) => ({ id: String(i + 11), role: "user" as const, content: `Recent message ${i} ` + "a".repeat(3000), created_at: "now" }));
  const store = {
    summary: async () => summary,
    summaryBatch: async (_client: string, _chat: string, after?: string) => after ? [] : pending,
    saveSummary: async (_client: string, _chat: string, through: string, content: string) => { summary = { content, through_message_id: through }; },
    conversations: { messages: async () => recent },
    list: async () => [{ memory_key: "language", content: "Use Hebrew", updated_at: "now" }],
    search: async (client: string, excluded: string | null) => {
      assert.equal(client, "1"); assert.equal(excluded, "chat");
      return [{ conversation_id: "old", content: "We discussed summer shirts", created_at: "yesterday", title: "Summer", kind: "message" }];
    }
  } as unknown as MemoryStore;
  const memory = new ConversationMemory(store, "1", "chat", "30", "summer", async (previous, batch) => {
    calls++;
    assert.equal(previous, ""); assert.equal(batch.length, 10);
    if (fail) throw new Error("Provider unavailable");
    return "Older discussion summary";
  });
  const context = await memory.context();
  assert.equal(summary?.through_message_id, "10");
  assert.match(context.reference, /Older discussion summary|Use Hebrew|summer shirts/);
  assert.ok(context.history.reduce((sum, message) => sum + String(message.content).length, 0) <= 16000);
  await memory.context();
  assert.equal(calls, 1);
  summary = undefined; fail = true;
  assert.ok((await memory.context()).history.length > 0);
  assert.equal(summary, undefined);
});

test("real PostgreSQL memory ownership, cross-chat retrieval, summary watermarks and deletion cascades", { skip: process.env.RUN_CHAT_DB_TESTS !== "1" }, async () => {
  const env = parse(readFileSync(".env"));
  const pool = new Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  const connection = await pool.connect();
  const db = { query: ((sql: string, values?: unknown[]) => connection.query(sql.replaceAll("public.", "pg_temp."), values)) as Pool["query"] };
  try {
    await connection.query("begin");
    await connection.query("create temporary table users (id bigint primary key)");
    await connection.query("insert into pg_temp.users values (1),(2)");
    for (const file of ["docs/sql/chat-history.sql", "docs/sql/chat-memory.sql"]) {
      await connection.query(readFileSync(file, "utf8").replace(/^begin;$/m, "").replace(/^commit;$/m, "").replaceAll("public.", "pg_temp."));
    }
    const conversations = new ConversationStore(db);
    const store = new MemoryStore(db);
    const first = await conversations.open("1", "first");
    const otherClient = await conversations.open("2", "other");
    const request = "Remember my brand is Blue Shirts";
    const source = await conversations.append("1", first.id, "user", request);
    const memory = new ConversationMemory(store, "1", first.id, source, request, async () => "Brand: Blue Shirts. No store changes were confirmed.");
    await memory.remember("brand", "my brand is Blue Shirts");
    assert.equal((await store.list("1"))[0].memory_key, "brand");
    assert.deepEqual(await store.list("2"), []);
    await assert.rejects(store.remember("2", first.id, source, "brand", "Blue Shirts"));
    await assert.rejects(store.remember("1", first.id, source, "brand", "Invented fact"));
    for (let i = 0; i < 32; i++) await conversations.append("1", first.id, "user", `Message ${i}`);
    await memory.context();
    const summary = await store.summary("1", first.id);
    assert.ok(summary);
    assert.match(summary.content, /Blue Shirts/);
    await store.saveSummary("1", first.id, source, "Outdated summary", "0");
    assert.equal((await store.summary("1", first.id))?.content, summary.content);
    const second = await conversations.open("1", "second");
    const secondSource = await conversations.append("1", second.id, "user", "What is my brand?");
    const resumed = new ConversationMemory(new MemoryStore(db), "1", second.id, secondSource, "brand");
    const context = await resumed.context();
    assert.match(context.reference, /Blue Shirts/);
    assert.ok((await resumed.search("Blue Shirts")).some(row => row.conversation_id === first.id));
    const short = await conversations.open("1", "short-chat");
    await conversations.append("1", short.id, "user", "Summer promotion for hoodies");
    assert.equal(await store.summary("1", short.id), undefined);
    assert.ok((await resumed.search("hoodies")).some(row => row.conversation_id === short.id));
    assert.deepEqual(await store.search("2", otherClient.id, "Blue Shirts"), []);
    const selfQuery = await conversations.append("1", second.id, "user", "uniqueselfquery");
    assert.deepEqual(await store.search("1", null, "uniqueselfquery", selfQuery), []);
    assert.equal(await store.forget("2", "brand"), false);
    assert.equal((await store.list("1")).length, 1);
    await conversations.clear("1", first.id);
    assert.deepEqual(await store.list("1"), []);
    assert.equal(await store.summary("1", first.id), undefined);
    assert.deepEqual(await resumed.search("Blue Shirts"), []);
    const doomed = await conversations.open('1','delete-cascade');
    const sourceId = await conversations.append('1',doomed.id,'user','Remember my preferred tone is concise');
    await store.remember('1',doomed.id,sourceId,'tone','preferred tone is concise');
    await store.saveSummary('1',doomed.id,sourceId,'Tone preference');
    await assert.rejects(conversations.delete('2',doomed.id));
    await conversations.delete('1',doomed.id);
    assert.deepEqual(await store.list('1'),[]);
    assert.equal((await connection.query('select count(*)::int as count from pg_temp.chat_summaries where conversation_id=$1',[doomed.id])).rows[0].count,0);
    assert.equal((await connection.query('select count(*)::int as count from pg_temp.chat_messages where conversation_id=$1',[doomed.id])).rows[0].count,0);
    await conversations.requireOwned('1',second.id);
    const security = await connection.query("select relrowsecurity from pg_class where oid in ('pg_temp.chat_summaries'::regclass,'pg_temp.chat_memories'::regclass)");
    assert.ok(security.rows.every(row => row.relrowsecurity));
    const grants = await connection.query("select has_table_privilege('anon','pg_temp.chat_memories','SELECT') as anon, has_table_privilege('authenticated','pg_temp.chat_summaries','SELECT') as authenticated");
    assert.deepEqual(grants.rows[0], { anon: false, authenticated: false });
  } finally {
    await connection.query("rollback"); connection.release(); await pool.end();
  }
});
