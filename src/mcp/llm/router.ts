// src/mcp/llm/router.ts
import { quickRules } from "./quickRules";
import { analyzeIntent } from "./intentAnalyzer";
import { askLLM, buildToolIntro } from "./llm";
import { addUserMessage, addAssistantMessage } from "./history";
import type { IntentDecision, MCPToolResponse, BotReply, ToolCtx } from "../types";
import crypto from "node:crypto";

import { getWizard } from "./wizards/createProductWizard/state";
import {
  startCreateProductWizard,
  handleCreateProductWizardStep
} from "./wizards/createProductWizard/handler";

import { getUpdateWizard } from "./wizards/updateProductWizard/state";
import {
  startUpdateProductWizard,
  handleUpdateProductWizardStep
} from "./wizards/updateProductWizard/handler";

import { getBulkWizard } from "./wizards/bulkUpdateWizard/state";
import {
  startBulkUpdateWizard,
  handleBulkUpdateWizardStep
} from "./wizards/bulkUpdateWizard/handler";

import type { ClientContext } from "../types";
import type { ClientConfig } from "../../clientConfig/types.js";

interface HandleCtx {
  client: ClientContext;
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
  server: any,
  ctx?: HandleCtx,
  sessionIdFromClient?: string
): Promise<BotReply> {
  const debugClient = buildClientDebug(ctx);
  const debugClientConfig = buildClientConfigDebug(ctx);
  const toolCtx = buildToolCtx(ctx);

  const browserSessionId = normalizeSessionId(sessionIdFromClient);
  const tenantId = ctx?.client?.id != null ? String(ctx.client.id) : "default";
  const sessionKey = `${tenantId}:${browserSessionId}`;

  addUserMessage(sessionKey, message);

  const low = message.toLowerCase().trim();

  const clientConfig = ctx?.clientConfig;
  const prefs = clientConfig?.prefs;
  const settings = clientConfig?.settings;

  const allowRealName =
    typeof prefs?.allowRealName === "boolean" ? prefs.allowRealName : true;

  const rawClientName = getClientName(ctx);
  const clientDisplayName = allowRealName ? rawClientName : undefined;

  const confirmCreateProduct =
    typeof settings?.confirmations?.createProduct === "boolean"
      ? settings.confirmations.createProduct
      : true;

  const confirmUpdateProduct =
    typeof settings?.confirmations?.updateProduct === "boolean"
      ? settings.confirmations.updateProduct
      : true;

  const confirmDeleteProduct =
    typeof settings?.confirmations?.deleteProduct === "boolean"
      ? settings.confirmations.deleteProduct
      : true;

  // confirmCreateProduct, confirmUpdateProduct, confirmDeleteProduct are kept for later use

  // ============================================================
  // 1. CHECK IF A WIZARD IS ALREADY ACTIVE
  // ============================================================
  const activeCreate = getWizard(sessionKey);
  const activeUpdate = getUpdateWizard(sessionKey);
  const activeBulk = getBulkWizard(sessionKey);

  if (activeCreate && activeCreate.mode === "create_product") {
    const wizardResult = await handleCreateProductWizardStep(
      sessionKey,
      message,
      toolCtx
    );

    addAssistantMessage(sessionKey, wizardResult.reply);

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

  if (activeUpdate) {
    const wizardResult = await handleUpdateProductWizardStep(
      sessionKey,
      message,
      toolCtx
    );

    addAssistantMessage(sessionKey, wizardResult.reply);

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

  if (activeBulk) {
    const wizardResult = await handleBulkUpdateWizardStep(
      sessionKey,
      message,
      toolCtx
    );

    addAssistantMessage(sessionKey, wizardResult.reply);

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

  // ============================================================
  // 2. DIRECT CREATE PRODUCT PATTERN
  // ============================================================
  const wantsCreateProduct =
    /create\s+(a\s+)?product/.test(low) ||
    /add\s+(a\s+)?product/.test(low) ||
    /new\s+product/.test(low);

  if (wantsCreateProduct) {
    const intro = startCreateProductWizard(sessionKey);

    addAssistantMessage(sessionKey, intro);

    return {
      text: intro,
      debug: makeDebug(
        {
          mode: "WIZARD START",
          wizard: "create_product",
          sessionId: sessionKey
        },
        debugClient,
        debugClientConfig
      )
    };
  }

  // ============================================================
  // 3. FAST RULES
  // ============================================================
  const fast = quickRules(message);

  if (fast.hit) {
    if (fast.tool === "wizard_update_product") {
      const wizardResult = await startUpdateProductWizard(
        sessionKey,
        fast.args || {},
        toolCtx
      );

      addAssistantMessage(sessionKey, wizardResult.reply);

      return {
        text: wizardResult.reply,
        debug: makeDebug(
          {
            mode: "WIZARD START",
            wizard: "update_product",
            target: fast.args || {},
            sessionId: sessionKey
          },
          debugClient,
          debugClientConfig
        )
      };
    }

    if (fast.tool === "wizard_bulk_update") {
      const wizardResult = await startBulkUpdateWizard(
        sessionKey,
        fast.args || {},
        toolCtx
      );

      addAssistantMessage(sessionKey, wizardResult.reply);

      return {
        text: wizardResult.reply,
        debug: makeDebug(
          {
            mode: "WIZARD START",
            wizard: "bulk_update",
            target: fast.args || {},
            sessionId: sessionKey
          },
          debugClient,
          debugClientConfig
        )
      };
    }

    if (!fast.tool && fast.askUser) {
      addAssistantMessage(sessionKey, fast.askUser);

      return {
        text: fast.askUser,
        debug: makeDebug(
          {
            mode: "FAST RULE BLOCK",
            reason: "User hit a quick rule block that requires clarification.",
            sessionId: sessionKey
          },
          debugClient,
          debugClientConfig
        )
      };
    }

    if (fast.tool) {
      const tool = server.tools[fast.tool];
      if (!tool) {
        const msg = `Tool ${fast.tool} not found.`;
        addAssistantMessage(sessionKey, msg);

        return {
          text: msg,
          debug: makeDebug(
            {
              mode: "FAST RULE",
              error: "Tool not registered",
              sessionId: sessionKey
            },
            debugClient,
            debugClientConfig
          )
        };
      }

      const result: MCPToolResponse = await tool.handler(
        fast.args ?? {},
        toolCtx
      );

      const rawText = result.content?.[0]?.text || "(empty)";

      const intro = await buildToolIntro({
        toolName: fast.tool,
        lastUserMessage: message,
        clientName: clientDisplayName
      });

      const combined = intro ? `${intro}\n\n${rawText}` : rawText;

      addAssistantMessage(sessionKey, combined);

      return {
        text: combined,
        debug: makeDebug(
          {
            mode: "FAST RULE",
            toolUsed: fast.tool,
            args: fast.args,
            sessionId: sessionKey
          },
          debugClient,
          debugClientConfig
        )
      };
    }
  }

  // ============================================================
  // 4. AI INTENT
  // ============================================================
  const ai: IntentDecision = await analyzeIntent(message);

  if (ai.shouldUseTool && ai.toolName === "wizard_update_product") {
    const rawArgs = ai.args || {};
    const target = (rawArgs as any).target || rawArgs;

    const wizardResult = await startUpdateProductWizard(
      sessionKey,
      target || {},
      toolCtx
    );

    addAssistantMessage(sessionKey, wizardResult.reply);

    return {
      text: wizardResult.reply,
      debug: makeDebug(
        {
          mode: "AI INTENT WIZARD START",
          wizard: "update_product",
          args: target || {},
          reason: ai.reason,
          sessionId: sessionKey
        },
        debugClient,
        debugClientConfig
      )
    };
  }

  if (ai.shouldUseTool && ai.toolName === "wizard_bulk_update") {
    const wizardArgs = ai.args || {};

    const wizardResult = await startBulkUpdateWizard(
      sessionKey,
      wizardArgs,
      toolCtx
    );

    addAssistantMessage(sessionKey, wizardResult.reply);

    return {
      text: wizardResult.reply,
      debug: makeDebug(
        {
          mode: "AI INTENT WIZARD START",
          wizard: "bulk_update",
          args: wizardArgs,
          reason: ai.reason,
          sessionId: sessionKey
        },
        debugClient,
        debugClientConfig
      )
    };
  }

  if (ai.shouldUseTool && ai.toolName) {
    const tool = server.tools[ai.toolName];

    if (!tool) {
      const msg = `Tool ${ai.toolName} not found.`;
      addAssistantMessage(sessionKey, msg);

      return {
        text: msg,
        debug: makeDebug(
          {
            mode: "AI INTENT",
            error: `AI selected tool "${ai.toolName}" but it does not exist`,
            reason: ai.reason,
            sessionId: sessionKey
          },
          debugClient,
          debugClientConfig
        )
      };
    }

    const result: MCPToolResponse = await tool.handler(
      ai.args ?? {},
      toolCtx
    );

    const intro = await buildToolIntro({
      toolName: ai.toolName,
      lastUserMessage: message,
      clientName: clientDisplayName
    });

    const body = result.content?.[0]?.text || "(empty)";
    const combined = `${intro}\n[[INTRO_BREAK]]\n${body}`;

    addAssistantMessage(sessionKey, combined);

    return {
      text: combined,
      debug: makeDebug(
        {
          mode: "AI INTENT",
          toolUsed: ai.toolName,
          args: ai.args,
          reason: ai.reason,
          sessionId: sessionKey
        },
        debugClient,
        debugClientConfig
      )
    };
  }

  // ============================================================
  // 5. SAFETY
  // ============================================================
  if (low.includes("update") && low.includes("product")) {
    const msg =
      "I did not start an update yet because I am not sure exactly what you want to change.\n\n" +
      "You can say for example:\n" +
      "• update product 1864\n" +
      "• update product mouse-1\n" +
      "• update all products by 10%\n" +
      "• update products in category 15\n" +
      "and I will start the correct update wizard.";

    addAssistantMessage(sessionKey, msg);

    return {
      text: msg,
      debug: makeDebug(
        {
          mode: "SAFE UPDATE BLOCK",
          note:
            "Prevented LLM fallback on update phrase so the model does not pretend it updated WooCommerce.",
          aiReason: ai.reason || null,
          sessionId: sessionKey
        },
        debugClient,
        debugClientConfig
      )
    };
  }

  // ============================================================
  // 6. LLM FALLBACK PURE CHAT
  // ============================================================
  const completion = await askLLM(message, {
    clientName: clientDisplayName,
    sessionKey
  });

  const text = completion.choices?.[0]?.message?.content || "(no content from LLM)";
  addAssistantMessage(sessionKey, text);

  return {
    text,
    debug: makeDebug(
      {
        mode: "LLM FALLBACK",
        toolUsed: null,
        aiReason: ai.reason || null,
        sessionId: sessionKey
      },
      debugClient,
      debugClientConfig
    )
  };
}
