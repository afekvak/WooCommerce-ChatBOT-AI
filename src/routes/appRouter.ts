// src/routes/appRouter.ts

import { Router } from "express";
import { handleUserMessage } from "../mcp/llm/router.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { getDb } from "../db/pool.js";
import { createClientResolver } from "../middleware/resolveClient.js";

// -------------------------
// DEBUG FLAG (from .env)
// -------------------------
const CHAT_DEBUG_JSON = process.env.CHAT_DEBUG_BLOCKS === "true";
console.log("Chat debug JSON responses mode", CHAT_DEBUG_JSON);

export function createAppRouter(server: McpServer) {
  const router = Router();

  // Single DB pool + client resolver
  const db = getDb();
  const clientResolver = createClientResolver(db);

  // ==========================
  // CHAT WIDGET ENDPOINT
  // ==========================
  router.post("/chat", async (req, res) => {
    try {
      const { message, clientKey } = req.body || {};

      if (!message || typeof message !== "string") {
        return res.status(400).json({
          text: "Missing message",
          debug: CHAT_DEBUG_JSON ? "NO_MESSAGE" : "",
        });
      }

      if (!clientKey || typeof clientKey !== "string") {
        return res.status(401).json({
          text: "Missing client key",
          debug: CHAT_DEBUG_JSON ? "NO_CLIENT_KEY" : "",
        });
      }

      // Resolve client from DB
      const client = await clientResolver.resolveClientByKey(clientKey.trim());
      if (!client) {
        return res.status(401).json({
          text: "Invalid client key",
          debug: CHAT_DEBUG_JSON ? "CLIENT_NOT_FOUND" : "",
        });
      }

      const result = await handleUserMessage(message, server, { client });

      res.json({
        text: result.text || "",
        debug: CHAT_DEBUG_JSON ? result.debug || "" : "",
      });
    } catch (err) {
      console.error("❌ Chat endpoint error:", err);
      res.status(500).json({
        text: "Server error",
        debug: CHAT_DEBUG_JSON ? (err as Error).message : "",
      });
    }
  });

  // ==========================
  // MCP ENDPOINT (Claude / VSCode)
  // ==========================
  router.post(/^\/mcp(\/.*)?$/, async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  // ==========================
  // HEALTH CHECK
  // ==========================
  router.get("/health", (_req, res) => {
    res.json({ ok: true, name: "woo-mcp-server" });
  });

  return router;
}
