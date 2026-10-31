import {getPendingProductName,askProductName,answerProductName} from "./wizards/productCreation";
import {getCatalogChange,continueCatalogChange} from "./wizards/catalogWizard";
// src/mcp/llm/router.ts
import { runToolConversation } from "./toolCalling";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import type { ConversationHistory } from "./history";
import type { BotReply, ToolCtx } from "../types";
import crypto from "node:crypto";

import { getWizard } from "./wizards/createProductWizard/state";
import {
  handleCreateProductWizardStep
} from "./wizards/createProductWizard/handler";

import { getUpdateWizard } from "./wizards/updateProductWizard/state";
import {
  handleUpdateProductWizardStep
} from "./wizards/updateProductWizard/handler";

import { getBulkWizard } from "./wizards/bulkUpdateWizard/state";
import {
  handleBulkUpdateWizardStep
} from "./wizards/bulkUpdateWizard/handler";

import type { ClientContext } from "../types";
import type { ClientConfig } from "../../clientConfig/types.js";
import type { MemoryStore } from "../../db/memory";
import { ConversationMemory } from "../../services/chatMemory";

interface HandleCtx {
  client: ClientContext;
  history: ConversationHistory;
  memoryStore?: MemoryStore;
  clientConfig?: ClientConfig;
}

function buildClientDebug(ctx?: HandleCtx) {
  if (!ctx || !ctx.client) return null;

  const c = ctx.client;

  const keyFingerprint =
    c.clientKey && c.clientKey.length > 0
      ? crypto.createHash("sha256").update(c.clientKey, "utf8").digest("hex").slice(0, 12)
      : null;

  return {
    id: c.id ?? null,
    name: c.name ?? null,
    wooUrl: c.wooUrl ?? null,
    wooCk: c.wooCk ? "***" : null,
    wooCs: c.wooCs ? "***" : null,
    clientKey: c.clientKey ? "***" : null,
    clientKeyFingerprint: keyFingerprint,
    clientKeyLength: c.clientKey ? c.clientKey.length : 0
  };
}

function buildClientConfigDebug(ctx?: HandleCtx) {
  const cfg = ctx?.clientConfig;

  return {
    hasClientConfig: !!cfg,
    prefs: {
      allowRealName:
        typeof cfg?.prefs?.allowRealName === "boolean" ? cfg.prefs.allowRealName : null
    },
    settings: {
      confirmations:
        cfg?.settings?.confirmations && typeof cfg.settings.confirmations === "object"
          ? cfg.settings.confirmations
          : null
    },
    ui: {
      theme: typeof cfg?.ui?.theme === "string" ? cfg.ui.theme : null,
      scale: typeof cfg?.ui?.scale === "number" ? cfg.ui.scale : null,
      defaultWide: typeof cfg?.ui?.defaultWide === "boolean" ? cfg.ui.defaultWide : null
    }
  };
}

function buildToolCtx(ctx?: HandleCtx): ToolCtx | undefined {
  if (!ctx || !ctx.client) return undefined;

  return {
    client: ctx.client,
    clientConfig: ctx.clientConfig
  };
}

function getClientName(ctx?: HandleCtx): string | undefined {
  if (!ctx || !ctx.client) return undefined;

  const c: any = ctx.client;
  return (
    (typeof c.fullName === "string" && c.fullName) ||
    (typeof c.name === "string" && c.name) ||
    (typeof c.displayName === "string" && c.displayName) ||
    undefined
  );
}

function makeDebug(
  base: Record<string, unknown>,
  debugClient: any,
  debugClientConfig: any
) {
  return JSON.stringify(
    {
      ...base,
      client: debugClient,
      clientConfig: debugClientConfig
    },
    null,
    2
  );
}

function normalizeSessionId(sessionId?: unknown) {
  if (typeof sessionId !== "string") return "default";
  const s = sessionId.trim();
  if (!s) return "default";
  if (s.length > 128) return s.slice(0, 128);
  return s;
}

export async function handleUserMessage(
  message: string,
  server: McpServer,
  ctx?: HandleCtx,
  sessionIdFromClient?: string
): Promise<BotReply> {
  const debugClient = buildClientDebug(ctx);
  const debugClientConfig = buildClientConfigDebug(ctx);
  const toolCtx = buildToolCtx(ctx);

  const browserSessionId = normalizeSessionId(sessionIdFromClient);
  const tenantId = ctx?.client?.id != null ? String(ctx.client.id) : "default";
  const sessionKey = `${tenantId}:${browserSessionId}`;

  if (!ctx?.history) throw new Error("Persistent conversation history is required");
  const history = ctx.history;
  const sourceMessageId = await history.append("user", message);
  const memory = ctx.memoryStore ? new ConversationMemory(
    ctx.memoryStore, String(ctx.client.id), history.conversationId, sourceMessageId, message
  ) : undefined;

  const clientConfig = ctx?.clientConfig;
  const prefs = clientConfig?.prefs;

  const allowRealName =
    typeof prefs?.allowRealName === "boolean" ? prefs.allowRealName : true;

  const rawClientName = getClientName(ctx);
  const clientDisplayName = allowRealName ? rawClientName : undefined;

  // ============================================================
  // 1. CHECK IF A WIZARD IS ALREADY ACTIVE
  // ============================================================
  const activeCreate = getWizard(sessionKey);
  const activeUpdate = getUpdateWizard(sessionKey);
  const activeBulk = getBulkWizard(sessionKey);
  const activeCatalog = getCatalogChange(sessionKey);
  const activeName = getPendingProductName(sessionKey);

  // Side questions must not be consumed as answers to a workflow prompt.
  const sideQuestion = /^(?:what|which|who|when|where|why|how|show|list|find|search|remember|do you|can you (?:show|tell|find)|tell me)\b/i.test(message.trim()) || /\?\s*$/.test(message);
  const hasPendingWorkflow = !!(activeCreate || activeUpdate || activeBulk || activeCatalog || activeName);
  if (/^(?:what (?:was|is) my (?:last|previous) message|what did i (?:just|last) (?:say|ask))[?.!]*$/i.test(message.trim())) {
    const userMessages = (await history.recent()).filter(entry => entry.role === "user");
    const previous = userMessages[userMessages.length - 2]?.content;
    const quoted = typeof previous === "string" ? previous.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\[\[/g, "&#91;&#91;") : null;
    const text = quoted ? 'Your previous message was: ?' + quoted + '?' : "There is no earlier message from you in this chat.";
    await history.append("assistant", text);
    return { text };
  }
  if (!sideQuestion && activeName) {
    const text = await answerProductName({...toolCtx,sessionKey},message);
    await history.append("assistant",text);
    return {text,debug:makeDebug({mode:"WIZARD",wizard:"product_name"},debugClient,debugClientConfig)};
  }
  if (!hasPendingWorkflow && /^(?:add|create)\s+(?:(?:a|an|new|a new)\s+)?product[.!]?$/i.test(message.trim())) {
    const text=askProductName(sessionKey);
    await history.append("assistant",text);
    return {text,debug:makeDebug({mode:"WIZARD",wizard:"product_name"},debugClient,debugClientConfig)};
  }
  if (!sideQuestion && activeCatalog) {
    const result = await continueCatalogChange({...toolCtx,sessionKey},message);
    await history.append("assistant",result.reply);
    return {text:result.reply,debug:makeDebug({mode:"WIZARD",wizard:"catalog",done:result.done},debugClient,debugClientConfig)};
  }
  if (!sideQuestion && activeCreate && activeCreate.mode === "create_product") {
    const wizardResult = await handleCreateProductWizardStep(
      sessionKey,
      message,
      toolCtx
    );

    await history.append("assistant", wizardResult.reply);

    return {
      text: wizardResult.reply,
      debug: makeDebug(
        {
          mode: "WIZARD",
          wizard: "create_product",
          done: wizardResult.done,
          sessionId: sessionKey
        },
        debugClient,
        debugClientConfig
      )
    };
  }

  if (!sideQuestion && activeUpdate) {
    const wizardResult = await handleUpdateProductWizardStep(
      sessionKey,
      message,
      toolCtx
    );

    await history.append("assistant", wizardResult.reply);

    return {
      text: wizardResult.reply,
      debug: makeDebug(
        {
          mode: "WIZARD",
          wizard: "update_product",
          done: wizardResult.done,
          sessionId: sessionKey
        },
        debugClient,
        debugClientConfig
      )
    };
  }

  if (!sideQuestion && activeBulk) {
    const wizardResult = await handleBulkUpdateWizardStep(
      sessionKey,
      message,
      toolCtx
    );

    await history.append("assistant", wizardResult.reply);

    return {
      text: wizardResult.reply,
      debug: makeDebug(
        {
          mode: "WIZARD",
          wizard: "bulk_update",
          done: wizardResult.done,
          sessionId: sessionKey
        },
        debugClient,
        debugClientConfig
      )
    };
  }

  // Native tool calling handles new requests; active workflows above stay deterministic.
  const context = memory ? await memory.context() : { history: await history.recent(), reference: undefined };
  const result = await runToolConversation({
    server,
    ctx: { ...toolCtx, sessionKey, memory },
    clientName: clientDisplayName,
    history: context.history,
    readOnly: sideQuestion && hasPendingWorkflow,
    memoryReference: [context.reference, hasPendingWorkflow && sideQuestion ? "A store change is pending. Answer this side question without changing or confirming the pending action. The user can resume it or say cancel." : ""].filter(Boolean).join("\n")
  });
  await history.append("assistant", result.text);
  return {
    text: result.text,
    debug: makeDebug(
      { mode: "NATIVE TOOL CALLING", toolsUsed: result.toolsUsed, sessionId: sessionKey },
      debugClient, debugClientConfig
    )
  };
}
