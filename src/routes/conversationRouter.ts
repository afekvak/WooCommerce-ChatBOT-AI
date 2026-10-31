import {clearPendingProductName} from "../mcp/llm/wizards/productCreation";
import {clearCatalogChange} from "../mcp/llm/wizards/catalogWizard";
import { Router } from "express";
import { z } from "zod";
import { ConversationNotFound, ConversationStore, withConversationTurn } from "../db/conversations";
import type { ClientRequest } from "../middleware/resolveClient";
import { clearWizard } from "../mcp/llm/wizards/createProductWizard/state";
import { clearUpdateWizard } from "../mcp/llm/wizards/updateProductWizard/state";
import { clearBulkWizard } from "../mcp/llm/wizards/bulkUpdateWizard/state";

export const conversationInput = z.object({
  sessionId: z.string().trim().min(1).max(128).optional(),
  conversationId: z.string().uuid().optional()
}).refine(value => value.sessionId || value.conversationId, "Session or conversation ID required");

export function createConversationRouter(store: ConversationStore) {
  const router = Router();
  router.use((req: ClientRequest, res, next) => {
    if (!req.clientContext) { res.status(401).json({ text: "Invalid client key" }); return; }
    next();
  });

  router.get("/", async (req: ClientRequest, res, next) => {
    try { res.json({ conversations: await store.list(String(req.clientContext!.id)) }); }
    catch (error) { next(error); }
  });

  // Open/resume once on widget load. IDs from another client return the same 404 as unknown IDs.
  router.post("/", async (req: ClientRequest, res, next) => {
    const parsed = conversationInput.safeParse(req.body);
    if (!parsed.success) { res.status(400).json({ text: "Invalid conversation input" }); return; }
    try {
      const clientId = String(req.clientContext!.id);
      const conversation = await store.open(clientId, parsed.data.sessionId || "default", parsed.data.conversationId);
      res.json({ conversation, messages: await store.messages(clientId, conversation.id) });
    } catch (error) { next(error); }
  });

  router.get("/:id/messages", async (req: ClientRequest, res, next) => {
    const id = z.string().uuid().safeParse(req.params.id);
    const before = z.string().regex(/^[1-9]\d{0,18}$/).optional().safeParse(req.query.before);
    if (!id.success || !before.success) { res.status(400).json({ text: "Invalid history request" }); return; }
    try {
      res.json({ messages: await store.messages(String(req.clientContext!.id), id.data, 100, before.data) });
    } catch (error) { next(error); }
  });

  router.post("/:id/clear", async (req: ClientRequest, res, next) => {
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) { res.status(400).json({ text: "Invalid conversation ID" }); return; }
    try {
      const clientId = String(req.clientContext!.id);
      const key = `${clientId}:${id.data}`;
      await withConversationTurn(key, async () => {
        await store.clear(clientId, id.data);
        clearWizard(key);
        clearUpdateWizard(key);
        clearBulkWizard(key); clearCatalogChange(key); clearPendingProductName(key);
      });
      res.json({ ok: true });
    } catch (error) { next(error); }
  });

  router.post("/:id/delete", async (req: ClientRequest, res, next) => {
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) { res.status(400).json({ text: "Invalid conversation ID" }); return; }
    try {
      const clientId = String(req.clientContext!.id);
      await withConversationTurn(clientId + ":" + id.data, async () => {
        await store.delete(clientId, id.data);
        const key = clientId + ":" + id.data;
        clearWizard(key); clearUpdateWizard(key); clearBulkWizard(key);
      });
      res.json({ ok: true });
    } catch (error) { next(error); }
  });

  router.use((error: unknown, _req: ClientRequest, res: import("express").Response, _next: import("express").NextFunction) => {
    if (error instanceof ConversationNotFound) {
      res.status(404).json({ text: "Conversation not found" }); return;
    }
    console.error("Conversation endpoint failed", error);
    res.status(503).json({ text: "Chat history unavailable. Check the database connection and chat-history.sql setup." });
  });
  return router;
}
