import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { parse } from "dotenv";
import { ConversationStore, ConversationNotFound, withConversationTurn } from "../src/db/conversations";
import { ConversationHistory } from "../src/mcp/llm/history";
import express from "express";
import { createConversationRouter } from "../src/routes/conversationRouter";

test("conversation turns serialize, recover after failure, and allow other chats to proceed", async () => {
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const events: string[] = [];
  const first = withConversationTurn("a", async () => { events.push("first"); await gate; throw new Error("failed"); });
  const rejected = assert.rejects(first, /failed/);
  const second = withConversationTurn("a", async () => { events.push("second"); });
  await withConversationTurn("b", async () => { events.push("other"); });
  assert.deepEqual(events, ["first", "other"]);
  release();
  await rejected;
  await second;
  assert.deepEqual(events, ["first", "other", "second"]);
});

// Opt in: uses only pg_temp tables on one connection, then rolls everything back.
test("PostgreSQL schema, persistence, ownership, pagination, and clear API", { skip: process.env.RUN_CHAT_DB_TESTS !== "1" }, async () => {
  const env = parse(readFileSync(".env"));
  const pool = new Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 5000 });
  const connection = await pool.connect();
  const db = { query: ((sql: string, values?: unknown[]) => connection.query(sql.replaceAll("public.", "pg_temp."), values)) as Pool["query"] };
  let http: import("node:http").Server | undefined;
  try {
    await connection.query("begin");
    await connection.query("create temporary table users (id bigint primary key)");
    await connection.query("insert into pg_temp.users values (1), (2)");
    const sql = readFileSync("docs/sql/chat-history.sql", "utf8")
      .replace(/^begin;$/m, "").replace(/^commit;$/m, "")
      .replaceAll("public.", "pg_temp.");
    await connection.query(sql);
    const store = new ConversationStore(db);
    const first = await store.open("1", "browser-a");
    assert.equal((await store.open("1", "browser-a")).id, first.id);
    assert.notEqual((await store.open("2", "browser-a")).id, first.id);
    await assert.rejects(store.open("2", "anything", first.id), ConversationNotFound);
    await assert.rejects(store.messages("2", first.id), ConversationNotFound);
    await assert.rejects(store.append("2", first.id, "user", "forbidden"), ConversationNotFound);
    await assert.rejects(store.clear("2", first.id), ConversationNotFound);

    const history = new ConversationHistory(store, "1", first.id);
    await history.append("user", "Remember my shop name is Blue Shirts");
    await history.append("assistant", "Your shop is Blue Shirts");
    // A fresh instance models a server restart: no in-memory history can help it.
    const restarted = new ConversationHistory(new ConversationStore(db), "1", first.id);
    assert.deepEqual(await restarted.recent(), [
      { role: "user", content: "Remember my shop name is Blue Shirts" },
      { role: "assistant", content: "Your shop is Blue Shirts" }
    ]);
    for (let i = 0; i < 22; i++) await history.append("user", `message ${i}`);
    assert.equal((await restarted.recent()).length, 20);
    const newest = await store.messages("1", first.id, 5);
    assert.equal(newest[4].content, "message 21");
    const older = await store.messages("1", first.id, 100, newest[0].id);
    assert.equal(older.length, 19);
    assert.equal((await store.list("1")).length, 1);

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      const id = req.header("x-test-client");
      if (id) (req as any).clientContext = { id };
      next();
    });
    app.use("/conversations", createConversationRouter(store));
    http = await new Promise(resolve => { const server = app.listen(0, "127.0.0.1", () => resolve(server)); });
    const port = (http.address() as import("node:net").AddressInfo).port;
    const url = `http://127.0.0.1:${port}/conversations`;
    assert.equal((await fetch(url)).status, 401);
    assert.equal((await fetch(`${url}/${first.id}/messages`, { headers: { "x-test-client": "2" } })).status, 404);
    assert.equal((await fetch(`${url}/not-a-uuid/messages`, { headers: { "x-test-client": "1" } })).status, 400);
    const loaded = await fetch(url, { method: "POST", headers: { "content-type": "application/json", "x-test-client": "1" }, body: JSON.stringify({ conversationId: first.id }) });
    assert.equal((await loaded.json()).messages.length, 24);
    const cleared = await fetch(`${url}/${first.id}/clear`, { method: "POST", headers: { "x-test-client": "1" } });
    assert.equal(cleared.status, 200);
    assert.equal((await restarted.recent()).length, 0);
    assert.equal((await store.list("1"))[0].title, "New conversation");

    assert.equal((await fetch(url + '/' + first.id + '/delete', {method:'POST',headers:{'x-test-client':'2'}})).status,404);
    assert.equal((await fetch(url + '/not-a-uuid/delete', {method:'POST',headers:{'x-test-client':'1'}})).status,400);
    assert.equal((await fetch(url + '/' + first.id + '/delete', {method:'POST'})).status,401);
    assert.equal((await fetch(url + '/' + first.id + '/delete', {method:'POST',headers:{'x-test-client':'1'}})).status,200);
    await assert.rejects(store.requireOwned('1',first.id),ConversationNotFound);
    assert.equal((await fetch(url + '/' + first.id + '/delete', {method:'POST',headers:{'x-test-client':'1'}})).status,404);
    const security = await connection.query("select relrowsecurity from pg_class where oid in ('pg_temp.chat_messages'::regclass, 'pg_temp.chat_conversations'::regclass)");
    assert.ok(security.rows.every(row => row.relrowsecurity));
    const grants = await connection.query("select has_table_privilege('anon', 'pg_temp.chat_messages', 'SELECT') as anon, has_table_privilege('authenticated', 'pg_temp.chat_conversations', 'SELECT') as authenticated");
    assert.deepEqual(grants.rows[0], { anon: false, authenticated: false });
  } finally {
    if (http) await new Promise<void>((resolve, reject) => http!.close(error => error ? reject(error) : resolve()));
    await connection.query("rollback");
    connection.release();
    await pool.end();
  }
});
