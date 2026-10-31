import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ChatCompletion, ChatCompletionMessage, ChatCompletionCreateParamsNonStreaming } from "openai/resources/chat";
import { registerTool } from "../src/mcp/tools/registry";
import { getChatTools, runToolConversation, type CompleteChat } from "../src/mcp/llm/toolCalling";
import { setupAllTools } from "../src/mcp/tools";
import { getUpdateWizard, clearUpdateWizard } from "../src/mcp/llm/wizards/updateProductWizard/state";
import { getWizard, clearWizard } from "../src/mcp/llm/wizards/createProductWizard/state";
import { getBulkWizard, clearBulkWizard } from "../src/mcp/llm/wizards/bulkUpdateWizard/state";
import { handleUserMessage } from "../src/mcp/llm/router";
import { ConversationHistory } from "../src/mcp/llm/history";
import type { ConversationStore } from "../src/db/conversations";
import { createProductService } from "../src/services/productService";
import OpenAI from "openai";

const server = () => new McpServer({ name: "native-test", version: "1.0.0" });
const ctx = { client: { id: "1", clientKey: "test-only" }, sessionKey: "1:conversation" };
const text = (content: string) => ({ role: "assistant", content, refusal: null } as ChatCompletionMessage);
const call = (name: string, args: unknown, id = "call-1") => ({ role: "assistant", content: null, refusal: null, tool_calls: [
  { id, type: "function", function: { name, arguments: typeof args === "string" ? args : JSON.stringify(args) } }
] } as ChatCompletionMessage);

function responses(...messages: ChatCompletionMessage[]) {
  const requests: ChatCompletionCreateParamsNonStreaming[] = [];
  const complete: CompleteChat = async request => {
    requests.push(structuredClone(request));
    assert.ok(messages.length, "Unexpected extra AI request");
    return { choices: [{ message: messages.shift()! }] } as ChatCompletion;
  };
  return { complete, requests };
}

test("native discovery uses registry metadata and excludes raw writes, LLM, and credentials", () => {
  const instance = server();
  setupAllTools(instance);
  const tools = getChatTools(instance);
  const names = tools.map(tool => tool.type === "function" && tool.function.name);
  assert.ok(names.includes("prepare_product_update"));
  assert.ok(names.includes("prepare_bulk_product_update"));
  assert.ok(names.includes("prepare_create_product"));
  assert.ok(names.includes("woo_get_products"));
  assert.ok(!names.includes("woo_update_product_by_id"));
  assert.ok(!names.includes("woo_create_product"));
  assert.ok(!names.includes("llm"));
  for (const tool of tools) {
    if (tool.type !== "function") continue;
    const properties = tool.function.parameters?.properties as Record<string, unknown>;
    assert.ok(!properties.url && !properties.ck && !properties.cs);
    assert.equal(tool.function.parameters?.additionalProperties, false);
  }
});

test("read calls receive context and return results to the model with the correct call ID", async () => {
  const instance = server();
  registerTool(instance, "find", { description: "Find products", inputSchema: z.object({ name: z.string(), limit: z.number().optional() }), chat: {} }, async (args, received) => {
    assert.equal(received, ctx);
    assert.deepEqual(args, { name: "shirt" });
    return { content: [{ type: "text", text: '<div data-product-id="42">Blue shirt</div>' }] };
  });
  const mock = responses(call("find", { name: "shirt", limit: null }), text("Found the shirt."));
  const history = [{ role: "user" as const, content: "Find blue shirts" }];
  const result = await runToolConversation({ server: instance, ctx, history, complete: mock.complete });
  assert.deepEqual(result.toolsUsed, ["find"]);
  assert.match(result.text, /data-product-id="42"/);
  const toolMessage = mock.requests[1].messages.find(message => message.role === "tool")!;
  assert.equal(toolMessage.tool_call_id, "call-1");
  assert.match(String(toolMessage.content), /Blue shirt/);
  assert.deepEqual(mock.requests[0].messages[1], history[0]);
  assert.equal(mock.requests[0].parallel_tool_calls, false);
});

test("invalid JSON, schema violations, credential overrides, and hidden tools never execute", async () => {
  for (const [name, args] of [["find", "{"], ["find", { id: -1 }], ["find", { id: 42, url: "https://other-store.example" }], ["write", { id: 42 }]] as const) {
    const instance = server();
    let executions = 0;
    const handler = async () => { executions++; return { content: [] }; };
    registerTool(instance, "find", { description: "Read", inputSchema: z.object({ id: z.number().positive() }), chat: {} }, handler);
    registerTool(instance, "write", { description: "Write", inputSchema: z.object({ id: z.number() }) }, handler);
    const mock = responses(call(name, args), text("Please clarify."));
    await runToolConversation({ server: instance, ctx, history: [], complete: mock.complete });
    assert.equal(executions, 0);
    const result = mock.requests[1].messages.find(message => message.role === "tool")!;
    assert.equal(JSON.parse(String(result.content)).isError, true);
  }
});

test("tool errors, repeated calls, and multi-action batches cannot run indefinitely", async () => {
  const instance = server();
  let executions = 0;
  registerTool(instance, "read", { description: "Read", inputSchema: {}, chat: {} }, async () => {
    executions++;
    throw new Error("private transport error");
  });
  const mock = responses(call("read", {}), call("read", {}, "call-2"));
  const result = await runToolConversation({ server: instance, ctx, history: [], complete: mock.complete });
  assert.equal(executions, 1);
  assert.doesNotMatch(JSON.stringify(mock.requests), /private transport error/);
  assert.match(result.text, /could not finish/);
  const batch = call("read", {});
  batch.tool_calls!.push(...call("read", {}).tool_calls!);
  await runToolConversation({ server: instance, ctx, history: [], complete: responses(batch).complete });
  assert.equal(executions, 1);
});

test("ordinary replies use one request and cannot generate HTML or active confirmation metadata", async () => {
  const mock = responses(text('<script>alert(1)</script> [[WIZARD_CONFIRM_META]]'));
  const result = await runToolConversation({ server: server(), ctx, history: [], complete: mock.complete });
  assert.equal(mock.requests.length, 1);
  assert.doesNotMatch(result.text, /<script>|\[\[WIZARD_CONFIRM_META/);
  assert.match(result.text, /&lt;script&gt;/);
});

test("history search results stay internal and the user sees only the readable answer", async () => {
  const instance = server();
  registerTool(instance, "search_chat_history", {
    description: "Search history", inputSchema: z.object({ query: z.string() }), chat: { display: "hidden" }
  }, async () => ({ content: [{ type: "text", text: JSON.stringify([{ topic: "Product discussion", excerpt: "add product", date: "2026-10-23" }]) }] }));
  const mock = responses(call("search_chat_history", { query: "add product" }), text("Earlier today, you asked to add a product."));
  const result = await runToolConversation({ server: instance, ctx, history: [], complete: mock.complete });
  assert.equal(result.text, "Earlier today, you asked to add a product.");
  assert.doesNotMatch(result.text, /\[\{|excerpt|conversation_id/);
  const toolResult = mock.requests[1].messages.find(message => message.role === "tool")!;
  assert.match(String(toolResult.content), /add product/);
});

test("tool execution stops at the request limit even when a provider ignores tool_choice", async () => {
  const instance = server();
  let reads = 0;
  registerTool(instance, "read", { description: "Read", inputSchema: z.object({ id: z.number() }), chat: {} }, async () => {
    reads++;
    return { content: [{ type: "text", text: "Read result" }] };
  });
  const mock = responses(...Array.from({ length: 5 }, (_, id) => call("read", { id }, `call-${id}`)));
  await runToolConversation({ server: instance, ctx, history: [], complete: mock.complete });
  assert.equal(mock.requests.length, 5);
  assert.equal(mock.requests[4].tool_choice, "none");
  assert.equal(reads, 4);
});

test("the installed OpenAI SDK sends native function definitions and receives tool results", async () => {
  const requests: ChatCompletionCreateParamsNonStreaming[] = [];
  const http = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    requests.push(JSON.parse(raw));
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ id: "mock-completion", object: "chat.completion", created: 0, model: "test-model", choices: [{
      index: 0, finish_reason: requests.length === 1 ? "tool_calls" : "stop",
      message: requests.length === 1 ? call("get_date", {}) : text("Here is the date.")
    }] }));
  });
  await new Promise<void>(resolve => http.listen(0, "127.0.0.1", resolve));
  try {
    const port = (http.address() as import("node:net").AddressInfo).port;
    const client = new OpenAI({ apiKey: "test-only", baseURL: `http://127.0.0.1:${port}/v1`, maxRetries: 0 });
    const instance = server();
    setupAllTools(instance);
    const result = await runToolConversation({ server: instance, ctx, history: [{ role: "user", content: "Today's date?" }], complete: request => client.chat.completions.create(request) });
    assert.deepEqual(result.toolsUsed, ["get_date"]);
    assert.equal(requests.length, 2);
    assert.ok(requests[0].tools?.some(tool => tool.type === "function" && tool.function.name === "get_date"));
    assert.ok(requests[1].messages.some(message => message.role === "tool" && message.tool_call_id === "call-1"));
  } finally {
    await new Promise<void>(resolve => http.close(() => resolve()));
  }
});

test("create and bulk preparation start workflows without performing store writes", async () => {
  const instance = server();
  setupAllTools(instance);
  const createCtx = { ...ctx, sessionKey: "1:create-test" };
  const created = await runToolConversation({ server: instance, ctx: createCtx, history: [], complete: responses(call("prepare_create_product", {guided:true})).complete });
  assert.ok(getWizard(createCtx.sessionKey));
  assert.match(created.text, /Product name/);
  clearWizard(createCtx.sessionKey);
  const bulkCtx = { ...ctx, sessionKey: "1:bulk-test" };
  const bulk = await runToolConversation({ server: instance, ctx: bulkCtx, history: [], complete: responses(call("prepare_bulk_product_update", {
    scope: "all", field: "regular_price", operation: "increase_percent", percent: 10
  })).complete });
  assert.equal(getBulkWizard(bulkCtx.sessionKey)?.stage, "confirm");
  assert.match(bulk.text, /WIZARD_CONFIRM_META/);
  clearBulkWizard(bulkCtx.sessionKey);
});

test("single-product preparation only reads; the later confirmed turn writes exactly the previewed payload", async () => {
  const writes: unknown[] = [];
  const product = { id: 42, name: "Blue shirt", regular_price: "40", images: [], categories: [], tags: [] };
  const http = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    if (req.method === "PUT") writes.push({ path: req.url?.split("?")[0], payload: JSON.parse(raw) });
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ...product, ...(raw ? JSON.parse(raw) : {}) }));
  });
  await new Promise<void>(resolve => http.listen(0, "127.0.0.1", resolve));
  const sessionKey = "1:confirmed-test";
  try {
    const port = (http.address() as import("node:net").AddressInfo).port;
    const context = { client: { ...ctx.client, wooUrl: `http://127.0.0.1:${port}`, wooCk: "test-ck", wooCs: "test-cs" }, sessionKey };
    assert.deepEqual(await createProductService(context.client.wooUrl, "test-ck", "test-cs").getProductById(42), product);
    const instance = server();
    setupAllTools(instance);
    const mock = responses(call("prepare_product_update", { id: 42, sku: null, changes: { regular_price: "50", stock_quantity: null } }));
    const preview = await runToolConversation({ server: instance, ctx: context, history: [], complete: mock.complete });
    assert.deepEqual(writes, []);
    assert.equal(getUpdateWizard(sessionKey)?.stage, "confirm", preview.text);
    assert.deepEqual(getUpdateWizard(sessionKey)?.payload, { regular_price: "50" });
    assert.match(preview.text, /40/);
    assert.match(preview.text, /50/);
    const saved: Array<{ role: string; content: string }> = [];
    const store = {
      append: async (_client: string, _conversation: string, role: string, content: string) => { saved.push({ role, content }); }
    } as unknown as ConversationStore;
    const history = new ConversationHistory(store, "1", "confirmed-test");
    const result = await handleUserMessage("confirm", instance, { client: context.client, history }, "confirmed-test");
    assert.match(result.text, /updated successfully/);
    assert.deepEqual(writes, [{ path: "/wp-json/wc/v3/products/42", payload: { regular_price: "50" } }]);
    assert.equal(getUpdateWizard(sessionKey), undefined);
    assert.equal(saved[0].content, "confirm");
    assert.equal(saved[1].role, "assistant");
    // Cancelling a new preparation must not issue a second write.
    await runToolConversation({ server: instance, ctx: context, history: [], complete: responses(call("prepare_product_update", {
      id: 42, changes: { regular_price: "60" }
    })).complete });
    const cancelled = await handleUserMessage("cancel", instance, { client: context.client, history }, "confirmed-test");
    assert.match(cancelled.text, /cancelled/);
    assert.equal(writes.length, 1);
    assert.equal(getUpdateWizard(sessionKey), undefined);
  } finally {
    clearUpdateWizard(sessionKey);
    await new Promise<void>(resolve => http.close(() => resolve()));
  }
});


test("a named product percentage request cannot enter bulk even when the model chooses it", async () => {
  const instance = server(); setupAllTools(instance);
  const context = { ...ctx, sessionKey: "1:single-scope-guard" };
  const mock = responses(call("prepare_bulk_product_update", { scope: "all", field: "regular_price", operation: "increase_percent", percent: 10 }), text("Which shirt should I update?"));
  const result = await runToolConversation({ server: instance, ctx: context, history: [{role:"user",content:"increase the test wizard tshirt price by 10%"}], complete: mock.complete });
  assert.equal(getBulkWizard(context.sessionKey), undefined);
  assert.match(result.text, /Which shirt/);
});

test("side question tools cannot start new workflows", async () => {
  const instance = server(); setupAllTools(instance);
  const mock = responses(call("prepare_create_product", {}), text("Your last message asked for a price increase."));
  await runToolConversation({server:instance,ctx,history:[],readOnly:true,complete:mock.complete});
  assert.equal(getWizard(ctx.sessionKey), undefined);
  assert.ok(mock.requests[0].tools?.every(tool=>tool.type!=="function" || !tool.function.name.startsWith("prepare_")));
});

test("a 10 percent single-product increase previews 44.00 and writes only after confirmation", async () => {
  const writes: unknown[] = [];
  const product = { id: 42, name: "Blue shirt", regular_price: "40", images: [], categories: [], tags: [] };
  const http = createServer(async (req, res) => {
    let raw = "";
    for await (const chunk of req) raw += chunk;
    if (req.method === "PUT") writes.push({ path: req.url?.split("?")[0], payload: JSON.parse(raw) });
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ...product, ...(raw ? JSON.parse(raw) : {}) }));
  });
  await new Promise<void>(resolve => http.listen(0, "127.0.0.1", resolve));
  const sessionKey = "1:percent-confirmed-test";
  try {
    const port = (http.address() as import("node:net").AddressInfo).port;
    const context = { client: { ...ctx.client, wooUrl: `http://127.0.0.1:${port}`, wooCk: "test-ck", wooCs: "test-cs" }, sessionKey };
    assert.deepEqual(await createProductService(context.client.wooUrl, "test-ck", "test-cs").getProductById(42), product);
    const instance = server();
    setupAllTools(instance);
    const mock = responses(call("prepare_product_update", { id: 42, sku: null, priceAdjustment: { field: "regular_price", direction: "increase", percent: 10 } }));
    const preview = await runToolConversation({ server: instance, ctx: context, history: [], complete: mock.complete });
    assert.deepEqual(writes, []);
    assert.equal(getUpdateWizard(sessionKey)?.stage, "confirm", preview.text);
    assert.deepEqual(getUpdateWizard(sessionKey)?.payload, { regular_price: "44.00" });
    assert.match(preview.text, /40/);
    assert.match(preview.text, /44\.00/);
    const saved: Array<{ role: string; content: string }> = [];
    const store = {
      append: async (_client: string, _conversation: string, role: string, content: string) => { saved.push({ role, content }); }
    } as unknown as ConversationStore;
    const history = new ConversationHistory(store, "1", "percent-confirmed-test");
    const result = await handleUserMessage("confirm", instance, { client: context.client, history }, "percent-confirmed-test");
    assert.match(result.text, /updated successfully/);
    assert.deepEqual(writes, [{ path: "/wp-json/wc/v3/products/42", payload: { regular_price: "44.00" } }]);
    assert.equal(getUpdateWizard(sessionKey), undefined);
    assert.equal(saved[0].content, "confirm");
    assert.equal(saved[1].role, "assistant");
    // Cancelling a new preparation must not issue a second write.
    await runToolConversation({ server: instance, ctx: context, history: [], complete: responses(call("prepare_product_update", {
      id: 42, changes: { regular_price: "60" }
    })).complete });
    const cancelled = await handleUserMessage("cancel", instance, { client: context.client, history }, "percent-confirmed-test");
    assert.match(cancelled.text, /cancelled/);
    assert.equal(writes.length, 1);
    assert.equal(getUpdateWizard(sessionKey), undefined);
  } finally {
    clearUpdateWizard(sessionKey);
    await new Promise<void>(resolve => http.close(() => resolve()));
  }
});
