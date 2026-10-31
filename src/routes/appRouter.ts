import { ConversationStore, ConversationNotFound, withConversationTurn } from "../db/conversations";
import { ConversationHistory } from "../mcp/llm/history";
import { MemoryStore } from "../db/memory";
import { conversationInput, createConversationRouter } from "./conversationRouter";
// src/routes/appRouter.ts

import { Router } from "express"; // import Express router 
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"; // MCP server type
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js"; // MCP HTTP transport so it can work over HTTP

import { handleUserMessage } from "../mcp/llm/router.js"; // main chat router logic

import { getDb } from "../db/pool.js"; // pg pool to get DB connections
import { createClientResolver } from "../middleware/resolveClient.js"; // resolves clientContext from clientKey
import type { ClientRequest } from "../middleware/resolveClient.js"; // import request type extended by resolveClient

import { createClientConfigResolver } from "../middleware/resolveClientConfig.js"; // resolves clientConfig from DB
import type { ClientConfigRequest } from "../middleware/resolveClientConfig.js"; // import request type extended by resolveClientConfig

// -------------------------
// DEBUG FLAG (from .env)
// -------------------------
const CHAT_DEBUG_JSON = process.env.CHAT_DEBUG_BLOCKS === "true"; // enable debug block responses
console.log("Chat debug JSON responses mode", CHAT_DEBUG_JSON); // log current mode to console

export function createAppRouter(server: McpServer) { // create the app router (accepts MCP server)
  const router = Router(); // create express router

  // Single DB pool + resolvers (created once)
  const db = getDb();
  const conversations = new ConversationStore(db);
  const memoryStore = new MemoryStore(db);
  const clientResolver = createClientResolver(db); // client resolver helpers + middleware accessing the DB
  const clientConfigResolver = createClientConfigResolver(db); // config resolver helpers + middleware accessing the DB
  router.use("/conversations", clientResolver.clientMiddleware, createConversationRouter(conversations));

// -------------------------
// CHAT WIDGET ENDPOINT
// -------------------------
// Now uses middleware to attach:
//   req.clientContext
//   req.clientConfig
// Also passes sessionId from the widget so history is per browser session
// ==========================
router.post(
  "/chat",
  clientResolver.clientMiddleware, // attach req.clientContext
  clientConfigResolver.clientConfigMiddleware, // attach req.clientConfig
  async (req: ClientRequest & ClientConfigRequest, res) => {
    try {
      const { message, sessionId, conversationId } = (req.body || {}) as {
        message?: unknown;
        sessionId?: unknown;
        conversationId?: unknown;
      }; // read message + sessionId

      // validate message
      if (!message || typeof message !== "string") {
        return res.status(400).json({
          text: "Missing message",
          debug: CHAT_DEBUG_JSON ? "NO_MESSAGE" : ""
        });
      }

      const parsedConversation = conversationInput.safeParse({
        sessionId: sessionId ?? (conversationId ? undefined : "default"), conversationId
      });
      if (!parsedConversation.success) {
        return res.status(400).json({ text: "Invalid conversation input" });
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

      const conversation = await conversations.open(
        String(client.id), parsedConversation.data.sessionId || "default", parsedConversation.data.conversationId
      );
      const history = new ConversationHistory(conversations, String(client.id), conversation.id);
      const result = await withConversationTurn(String(client.id) + ":" + conversation.id, () =>
        handleUserMessage(message, server, { client, clientConfig, history, memoryStore }, conversation.id)
      );

      return res.json({
        conversationId: conversation.id,
        text: result.text || "",
        debug: CHAT_DEBUG_JSON ? (result.debug || "") : "",
        ui: clientConfig?.ui || null,
        prefs: clientConfig?.prefs || null
      });
    } catch (err) {
      if (err instanceof ConversationNotFound) return res.status(404).json({ text: "Conversation not found" });
      if (["42P01", "42501"].includes((err as { code?: string }).code || "")) {
        return res.status(503).json({ text: "Chat storage unavailable. Check the setup instructions in docs/chat-history.md and docs/memory.md." });
      }
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
  // MCP ENDPOINT (Claude / VSCode) (not used by the chat widget)
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
  // HEALTH CHECK ENDPOINT
  // ==========================
  router.get("/health", (_req, res) => {
    res.json({ ok: true, name: "woo-mcp-server" });
  });




  return router; // return configured router to the app
}


// how it works:
// - creates the app router (accepts MCP server)
// - creates an express router
// ENDPOINTS // 
// - sets up a main chat endpoint at /chat with middleware to resolve client and config from DB
// - validates incoming message and sessionId
// - calls handleUserMessage (from the main mcp logic router) with the message, MCP server, client context, config, and sessionId
// - returns the chat response (from handleUserMessage func) with optional debug info, UI settings, and preferences

// - sets up an optional /client-config endpoint to fetch client configuration

// - *not used at the moment* sets up the MCP endpoint at /mcp for handling MCP requests from clients like Claude or VSCode

// - sets up a health check endpoint at /health

// - returns the configured router to be used by the express app
