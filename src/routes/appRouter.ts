// src/routes/appRouter.ts

import { Router } from "express"; // Express router
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"; // MCP server type
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"; // MCP HTTP transport

import { handleUserMessage } from "../mcp/llm/router.js"; // your main chat router logic

import { getDb } from "../db/pool.js"; // pg pool singleton
import { createClientResolver } from "../middleware/resolveClient.js"; // resolves clientContext from clientKey
import type { ClientRequest } from "../middleware/resolveClient.js"; // request type extended by resolveClient

import { createClientConfigResolver } from "../middleware/resolveClientConfig.js"; // resolves clientConfig from DB
import type { ClientConfigRequest } from "../middleware/resolveClientConfig.js"; // request type extended by resolveClientConfig

// -------------------------
// DEBUG FLAG (from .env)
// -------------------------
const CHAT_DEBUG_JSON = process.env.CHAT_DEBUG_BLOCKS === "true"; // enable debug block responses
console.log("Chat debug JSON responses mode", CHAT_DEBUG_JSON); // log current mode

export function createAppRouter(server: McpServer) {
  const router = Router(); // create express router

  // Single DB pool + resolvers (created once)
  const db = getDb(); // get pool
  const clientResolver = createClientResolver(db); // client resolver helpers + middleware
  const clientConfigResolver = createClientConfigResolver(db); // config resolver helpers + middleware

  // ==========================
  // CHAT WIDGET ENDPOINT
  // Now uses middleware to attach:
  //   req.clientContext
  //   req.clientConfig
  // ==========================
  router.post(
    "/chat",
    clientResolver.clientMiddleware, // attach req.clientContext
    clientConfigResolver.clientConfigMiddleware, // attach req.clientConfig
    async (req: ClientRequest & ClientConfigRequest, res) => {
      try {
        const { message } = (req.body || {}) as { message?: unknown }; // read message only, clientKey was handled by middleware

        // validate message
        if (!message || typeof message !== "string") {
          return res.status(400).json({
            text: "Missing message",
            debug: CHAT_DEBUG_JSON ? "NO_MESSAGE" : ""
          });
        }

        // require a valid resolved client
        const client = req.clientContext; // from resolveClient middleware
        if (!client) {
          return res.status(401).json({
            text: "Invalid client key",
            debug: CHAT_DEBUG_JSON ? "CLIENT_NOT_FOUND" : ""
          });
        }

        // optional config (should exist if clientKey exists, but keep safe)
        const clientConfig = req.clientConfig || undefined; // from resolveClientConfig middleware

        // pass BOTH client + config into the chat logic
        const result = await handleUserMessage(message, server, {
          client,
          clientConfig
        });

        return res.json({
  text: result.text || "",
  debug: CHAT_DEBUG_JSON ? (result.debug || "") : "",
  ui: clientConfig?.ui || null,
  prefs: clientConfig?.prefs || null
});

      } catch (err) {
        console.error("❌ Chat endpoint error:", err);
        return res.status(500).json({
          text: "Server error",
          debug: CHAT_DEBUG_JSON ? (err as Error).message : ""
        });
      }
    }
  );

  // ==========================
  // OPTIONAL: CONFIG FETCH ENDPOINT
  // Widget can call this to load ui_settings (theme, scale, etc.)
  // ==========================
  router.get(
    "/client-config",
    clientResolver.clientMiddleware, // attach req.clientContext
    clientConfigResolver.clientConfigMiddleware, // attach req.clientConfig
    async (req: ClientRequest & ClientConfigRequest, res) => {
      try {
        if (!req.clientContext) {
          return res.status(401).json({ ok: false, error: "Invalid client key" });
        }

        return res.json({
          ok: true,
          config: req.clientConfig || null
        });
      } catch (err) {
        console.error("❌ client-config endpoint error:", err);
        return res.status(500).json({ ok: false, error: "Server error" });
      }
    }
  );

  // ==========================
  // MCP ENDPOINT (Claude / VSCode)
  // ==========================
  router.post(/^\/mcp(\/.*)?$/, async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });

    res.on("close", () => transport.close()); // close transport on disconnect
    await server.connect(transport); // connect MCP server to transport
    await transport.handleRequest(req, res, req.body); // forward request
  });

  // ==========================
  // HEALTH CHECK
  // ==========================
  router.get("/health", (_req, res) => {
    res.json({ ok: true, name: "woo-mcp-server" });
  });

  return router; // return configured router
}
