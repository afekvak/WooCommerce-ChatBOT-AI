import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { executeTool, listTools, registerTool } from "../src/mcp/tools/registry";
import { setupAllTools } from "../src/mcp/tools";

function server() {
  return new McpServer({ name: "registry-test", version: "1.0.0" });
}

test("chat execution validates before invoking a handler and preserves client context", async () => {
  const instance = server();
  let calls = 0;
  const ctx = { client: { id: "store-1", clientKey: "test-key" } };
  registerTool(instance, "update", {
    description: "Test update", inputSchema: z.object({ id: z.number().positive() })
  }, async (args, receivedContext) => {
    calls++;
    assert.equal(receivedContext, ctx);
    assert.deepEqual(args, { id: 12 });
    return { content: [{ type: "text", text: "updated" }] };
  });
  assert.equal((await executeTool(instance, "update", { id: -1 }, ctx)).isError, true);
  assert.equal((await executeTool(instance, "missing", {}, ctx)).isError, true);
  assert.equal(calls, 0);
  assert.equal((await executeTool(instance, "update", { id: 12 }, ctx)).content[0].text, "updated");
  assert.equal(calls, 1);
  assert.equal(listTools(server()).length, 0);
  assert.throws(() => registerTool(instance, "update", {
    description: "Duplicate", inputSchema: {}
  }, async () => ({ content: [] })), /already registered/);
});

test("MCP discovers existing tools and executes them through the shared definitions", async () => {
  const instance = server();
  setupAllTools(instance);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await instance.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    const discovered = await client.listTools();
    assert.deepEqual(discovered.tools.map(tool => tool.name).sort(), listTools(instance).filter(tool => tool.mcp).map(tool => tool.name).sort());
    assert.equal(discovered.tools.length, 9);
    const update = discovered.tools.find(tool => tool.name === "woo_update_product_by_id")!;
    assert.ok(update.inputSchema.properties?.id);
    const invalid = await client.callTool({ name: update.name, arguments: { id: -1, payload: {} } });
    assert.equal(invalid.isError, true);
    const date = await client.callTool({ name: "get_date", arguments: {} });
    assert.match(JSON.stringify(date.content), /Today's date/);
  } finally {
    await client.close();
    await instance.close();
  }
});
