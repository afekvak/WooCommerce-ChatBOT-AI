// src/mcp/llm/router.ts

import { quickRules } from "./quickRules";
import { analyzeIntent } from "./intentAnalyzer";
import { askLLM, buildToolIntro } from "./llm";
import { addUserMessage, addAssistantMessage } from "./history";
import type { IntentDecision, MCPToolResponse, BotReply, ToolCtx } from "../types";

import { getWizard } from "./wizards/createProductWizard/state";
import {
  startCreateProductWizard,
  handleCreateProductWizardStep
} from "./wizards/createProductWizard/handler";

// update product wizard imports
import { getUpdateWizard } from "./wizards/updateProductWizard/state";
import {
  startUpdateProductWizard,
  handleUpdateProductWizardStep
} from "./wizards/updateProductWizard/handler";

// bulk update wizard imports
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

// helper to put full client info into debug (masking secrets)
function buildClientDebug(ctx?: HandleCtx) {
  if (!ctx || !ctx.client) return null;

  const c: any = ctx.client;
  const { wooCk, wooCs, ...rest } = c;

  return {
    ...rest,
    wooCk: wooCk ? "***" : null,
    wooCs: wooCs ? "***" : null
  };
}

// minimal view of client config to verify what the server loaded
function buildClientConfigDebug(ctx?: HandleCtx) {
  const cfg = ctx?.clientConfig;

  return {
    hasClientConfig: !!cfg,
    prefs: {
      allowRealName:
        typeof cfg?.prefs?.allowRealName === "boolean" ? cfg.prefs.allowRealName : null
    },
    settings: {
      // keep confirmations for later, but show what exists now
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

// helper for tools and wizards that expect { client }
function buildToolCtx(ctx?: HandleCtx): ToolCtx | undefined {
  if (!ctx || !ctx.client) return undefined;

  return {
    client: ctx.client,
    clientConfig: ctx.clientConfig
  };
}

// best effort to get a display name for the client
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

// single helper so every debug payload includes client + clientConfig
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

export async function handleUserMessage(
  message: string,
  server: any,
  ctx?: HandleCtx
): Promise<BotReply> {
  addUserMessage(message);

  const debugClient = buildClientDebug(ctx);
  const debugClientConfig = buildClientConfigDebug(ctx);
  const toolCtx = buildToolCtx(ctx);

  // per client session so wizards are separated by client
  const sessionId = ctx && ctx.client ? `client_${ctx.client.id}` : "default";

  const low = message.toLowerCase().trim();










  // ============================================================
  // CLIENT CONFIG (prefs, settings, ui)
  // Add future settings logic here
  // ============================================================
  const clientConfig = ctx?.clientConfig;

  const prefs = clientConfig?.prefs;
  const settings = clientConfig?.settings;
  const ui = clientConfig?.ui;

  // Name policy (no preferredName for now)
  const allowRealName =
    typeof prefs?.allowRealName === "boolean" ? prefs.allowRealName : true;

  const rawClientName = getClientName(ctx);

  // If not allowed, don't pass a name at all
  const clientDisplayName = allowRealName ? rawClientName : undefined;

  // Confirmation toggles (keep for later use inside wizards)
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

  // // UI settings (currently just loaded and exposed in debug)
  // const uiTheme = ui?.theme;
  // const uiScale = ui?.scale;
  // const uiDefaultWide = ui?.defaultWide;

  // NOTE: variables confirmCreateProduct/confirmUpdateProduct/confirmDeleteProduct,
  // uiTheme/uiScale/uiDefaultWide are intentionally "unused" for now.
  // They are here so you have one central place to apply them later.









  // ============================================================
  // 1. CHECK IF A WIZARD IS ALREADY ACTIVE
  // ============================================================
  const activeCreate = getWizard(sessionId);
  const activeUpdate = getUpdateWizard(sessionId);
  const activeBulk = getBulkWizard(sessionId);

  if (activeCreate && activeCreate.mode === "create_product") {
    const wizardResult = await handleCreateProductWizardStep(
      sessionId,
      message,
      toolCtx
    );

    return {
      text: wizardResult.reply,
      debug: makeDebug(
        {
          mode: "WIZARD",
          wizard: "create_product",
          done: wizardResult.done,
          sessionId
        },
        debugClient,
        debugClientConfig
      )
    };
  }

  if (activeUpdate) {
    const wizardResult = await handleUpdateProductWizardStep(
      sessionId,
      message,
      toolCtx
    );

    return {
      text: wizardResult.reply,
      debug: makeDebug(
        {
          mode: "WIZARD",
          wizard: "update_product",
          done: wizardResult.done,
          sessionId
        },
        debugClient,
        debugClientConfig
      )
    };
  }

  if (activeBulk) {
    const wizardResult = await handleBulkUpdateWizardStep(
      sessionId,
      message,
      toolCtx
    );

    return {
      text: wizardResult.reply,
      debug: makeDebug(
        {
          mode: "WIZARD",
          wizard: "bulk_update",
          done: wizardResult.done,
          sessionId
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
    const intro = startCreateProductWizard(sessionId);

    return {
      text: intro,
      debug: makeDebug(
        {
          mode: "WIZARD START",
          wizard: "create_product",
          sessionId
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
        sessionId,
        fast.args || {},
        toolCtx
      );

      return {
        text: wizardResult.reply,
        debug: makeDebug(
          {
            mode: "WIZARD START",
            wizard: "update_product",
            target: fast.args || {},
            sessionId
          },
          debugClient,
          debugClientConfig
        )
      };
    }

    if (fast.tool === "wizard_bulk_update") {
      const wizardResult = await startBulkUpdateWizard(
        sessionId,
        fast.args || {},
        toolCtx
      );

      return {
        text: wizardResult.reply,
        debug: makeDebug(
          {
            mode: "WIZARD START",
            wizard: "bulk_update",
            target: fast.args || {},
            sessionId
          },
          debugClient,
          debugClientConfig
        )
      };
    }

    if (!fast.tool && fast.askUser) {
      return {
        text: fast.askUser,
        debug: makeDebug(
          {
            mode: "FAST RULE BLOCK",
            reason: "User hit a quick rule block that requires clarification.",
            sessionId
          },
          debugClient,
          debugClientConfig
        )
      };
    }

    if (fast.tool) {
      const tool = server.tools[fast.tool];
      if (!tool) {
        return {
          text: `Tool ${fast.tool} not found.`,
          debug: makeDebug(
            {
              mode: "FAST RULE",
              error: "Tool not registered",
              sessionId
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

      return {
        text: combined,
        debug: makeDebug(
          {
            mode: "FAST RULE",
            toolUsed: fast.tool,
            args: fast.args,
            sessionId
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
      sessionId,
      target || {},
      toolCtx
    );

    return {
      text: wizardResult.reply,
      debug: makeDebug(
        {
          mode: "AI INTENT WIZARD START",
          wizard: "update_product",
          args: target || {},
          reason: ai.reason,
          sessionId
        },
        debugClient,
        debugClientConfig
      )
    };
  }

  if (ai.shouldUseTool && ai.toolName === "wizard_bulk_update") {
    const wizardArgs = ai.args || {};

    const wizardResult = await startBulkUpdateWizard(
      sessionId,
      wizardArgs,
      toolCtx
    );

    return {
      text: wizardResult.reply,
      debug: makeDebug(
        {
          mode: "AI INTENT WIZARD START",
          wizard: "bulk_update",
          args: wizardArgs,
          reason: ai.reason,
          sessionId
        },
        debugClient,
        debugClientConfig
      )
    };
  }

  if (ai.shouldUseTool && ai.toolName) {
    const tool = server.tools[ai.toolName];

    if (!tool) {
      return {
        text: `Tool ${ai.toolName} not found.`,
        debug: makeDebug(
          {
            mode: "AI INTENT",
            error: `AI selected tool "${ai.toolName}" but it does not exist`,
            reason: ai.reason,
            sessionId
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

    addAssistantMessage(`(used ${ai.toolName})`);

    return {
      text: combined,
      debug: makeDebug(
        {
          mode: "AI INTENT",
          toolUsed: ai.toolName,
          args: ai.args,
          reason: ai.reason,
          sessionId
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
    return {
      text:
        "I did not start an update yet because I am not sure exactly what you want to change.\n\n" +
        "You can say for example:\n" +
        "• update product 1864\n" +
        "• update product mouse-1\n" +
        "• update all products by 10%\n" +
        "• update products in category 15\n" +
        "and I will start the correct update wizard.",
      debug: makeDebug(
        {
          mode: "SAFE UPDATE BLOCK",
          note:
            "Prevented LLM fallback on update phrase so the model does not pretend it updated WooCommerce.",
          aiReason: ai.reason || null,
          sessionId
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
    clientName: clientDisplayName
  });

  const text = completion.choices?.[0]?.message?.content || "(no content from LLM)";
  addAssistantMessage(text);

  return {
    text,
    debug: makeDebug(
      {
        mode: "LLM FALLBACK",
        toolUsed: null,
        aiReason: ai.reason || null,
        sessionId
      },
      debugClient,
      debugClientConfig
    )
  };
}
