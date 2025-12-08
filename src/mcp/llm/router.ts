// src/mcp/llm/router.ts
import { quickRules } from "./quickRules";
import { analyzeIntent } from "./intentAnalyzer";
import { askLLM } from "./llm";
import { addUserMessage, addAssistantMessage } from "./history";
import type { IntentDecision, MCPToolResponse, BotReply } from "../types";

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

export async function handleUserMessage(
  message: string,
  server: any
): Promise<BotReply> {
  addUserMessage(message);

  const sessionId = "default"; // single session for now
  const low = message.toLowerCase().trim();

  // ============================================================
  // 1. CHECK IF A WIZARD IS ALREADY ACTIVE
  // ============================================================
  const activeCreate = getWizard(sessionId);
  const activeUpdate = getUpdateWizard(sessionId);
  const activeBulk = getBulkWizard(sessionId);

  if (activeCreate && activeCreate.mode === "create_product") {
    const wizardResult = await handleCreateProductWizardStep(
      sessionId,
      message
    );

    return {
      text: wizardResult.reply,
      debug: JSON.stringify(
        {
          mode: "WIZARD",
          wizard: "create_product",
          done: wizardResult.done
        },
        null,
        2
      )
    };
  }

  if (activeUpdate) {
    const wizardResult = await handleUpdateProductWizardStep(
      sessionId,
      message
    );

    return {
      text: wizardResult.reply,
      debug: JSON.stringify(
        {
          mode: "WIZARD",
          wizard: "update_product",
          done: wizardResult.done
        },
        null,
        2
      )
    };
  }

  if (activeBulk) {
    const wizardResult = await handleBulkUpdateWizardStep(
      sessionId,
      message
    );

    return {
      text: wizardResult.reply,
      debug: JSON.stringify(
        {
          mode: "WIZARD",
          wizard: "bulk_update",
          done: wizardResult.done
        },
        null,
        2
      )
    };
  }

  // ============================================================
  // 2. DIRECT CREATE PRODUCT PATTERN
  //    (intentAnalyzer must NOT call woo_create_product directly)
  // ============================================================
  const wantsCreateProduct =
    /create\s+(a\s+)?product/.test(low) ||
    /add\s+(a\s+)?product/.test(low) ||
    /new\s+product/.test(low);

  if (wantsCreateProduct) {
    const intro = startCreateProductWizard(sessionId);

    return {
      text: intro,
      debug: JSON.stringify(
        {
          mode: "WIZARD START",
          wizard: "create_product"
        },
        null,
        2
      )
    };
  }

  // ============================================================
  // 3. FAST RULES – ONLY VERY SIMPLE GUARDS (NUMBERS, ETC)
  // ============================================================
  const fast = quickRules(message);

  if (fast.hit) {
    // Start update wizard (id or sku) – if you ever bring this back into quickRules
    if (fast.tool === "wizard_update_product") {
      const wizardResult = await startUpdateProductWizard(
        sessionId,
        fast.args || {}
      );

      return {
        text: wizardResult.reply,
        debug: JSON.stringify(
          {
            mode: "WIZARD START",
            wizard: "update_product",
            target: fast.args || {}
          },
          null,
          2
        )
      };
    }

    // Start bulk update wizard – same idea
    if (fast.tool === "wizard_bulk_update") {
      const wizardResult = await startBulkUpdateWizard(
        sessionId,
        fast.args || {}
      );

      return {
        text: wizardResult.reply,
        debug: JSON.stringify(
          {
            mode: "WIZARD START",
            wizard: "bulk_update",
            target: fast.args || {}
          },
          null,
          2
        )
      };
    }

    // When fast rule says "stop and ask"
    if (!fast.tool && fast.askUser) {
      return {
        text: fast.askUser,
        debug: JSON.stringify(
          {
            mode: "FAST RULE BLOCK",
            reason:
              "User hit a quick rule block that requires clarification."
          },
          null,
          2
        )
      };
    }

    // NORMAL FAST RULE WITH TOOL (rare now)
    if (fast.tool) {
      const tool = server.tools[fast.tool];
      if (!tool) {
        return {
          text: `Tool ${fast.tool} not found.`,
          debug: JSON.stringify(
            {
              mode: "FAST RULE",
              error: "Tool not registered"
            },
            null,
            2
          )
        };
      }

      const result: MCPToolResponse = await tool.handler(fast.args ?? {}, {});
      return {
        text: result.content?.[0]?.text || "(empty)",
        debug: JSON.stringify(
          {
            mode: "FAST RULE",
            toolUsed: fast.tool,
            args: fast.args
          },
          null,
          2
        )
      };
    }
  }

  // ============================================================
  // 4. AI INTENT – MAIN BRAIN FOR TOOLS + WIZARDS
  // ============================================================
  const ai: IntentDecision = await analyzeIntent(message);

  // 4.a WIZARD STARTS DECIDED BY AI
  //     toolName "wizard_update_product" means:
  //     "start the update wizard, user gave id/sku but not the fields"
  if (ai.shouldUseTool && ai.toolName === "wizard_update_product") {
    const rawArgs = ai.args || {};
    const target = rawArgs.target || rawArgs; // supports { target:{id} } or { id }

    const wizardResult = await startUpdateProductWizard(
      sessionId,
      target || {}
    );

    return {
      text: wizardResult.reply,
      debug: JSON.stringify(
        {
          mode: "AI INTENT WIZARD START",
          wizard: "update_product",
          args: target || {},
          reason: ai.reason
        },
        null,
        2
      )
    };
  }

  // bulk wizard from AI
  if (ai.shouldUseTool && ai.toolName === "wizard_bulk_update") {
    const wizardArgs = ai.args || {};

    const wizardResult = await startBulkUpdateWizard(
      sessionId,
      wizardArgs
    );

    return {
      text: wizardResult.reply,
      debug: JSON.stringify(
        {
          mode: "AI INTENT WIZARD START",
          wizard: "bulk_update",
          args: wizardArgs,
          reason: ai.reason
        },
        null,
        2
      )
    };
  }

  // 4.b NORMAL MCP TOOLS SELECTED BY AI (woo_get_product_by_id etc)
  if (ai.shouldUseTool && ai.toolName) {
    const tool = server.tools[ai.toolName];

    if (!tool) {
      return {
        text: `Tool ${ai.toolName} not found.`,
        debug: JSON.stringify(
          {
            mode: "AI INTENT",
            error: `AI selected tool "${ai.toolName}" but it does not exist`,
            reason: ai.reason
          },
          null,
          2
        )
      };
    }

    const result: MCPToolResponse = await tool.handler(ai.args ?? {}, {});
    addAssistantMessage(`(used ${ai.toolName})`);

    return {
      text: result.content?.[0]?.text || "(empty)",
      debug: JSON.stringify(
        {
          mode: "AI INTENT",
          toolUsed: ai.toolName,
          args: ai.args,
          reason: ai.reason
        },
        null,
        2
      )
    };
  }

  // ============================================================
  // 5. SAFETY: NEVER LET "update product ..." FALL INTO RAW LLM
  //    (otherwise it will hallucinate "I updated the product")
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
      debug: JSON.stringify(
        {
          mode: "SAFE UPDATE BLOCK",
          note:
            "Prevented LLM fallback on update phrase so the model does not pretend it updated WooCommerce.",
          aiReason: ai.reason || null
        },
        null,
        2
      )
    };
  }

  // ============================================================
  // 6. LLM FALLBACK (PURE CHAT, NO TOOL / WIZARD)
  // ============================================================
  const completion = await askLLM(message);
  const text =
    completion.choices?.[0]?.message?.content || "(no content from LLM)";
  addAssistantMessage(text);

  return {
    text,
    debug: JSON.stringify(
      {
        mode: "LLM FALLBACK",
        toolUsed: null,
        aiReason: ai.reason || null
      },
      null,
      2
    )
  };
}
