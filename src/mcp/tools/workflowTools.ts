import {askProductName} from "../llm/wizards/productCreation";
import { productChangesSchema } from "../../services/productSchema";
import { prepareCatalogChange } from "../llm/wizards/catalogWizard";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import type { MCPToolResponse, ToolCtx } from "../types";
import { registerChatTool } from "./registry";
import { updateWorkflowSchema, bulkWorkflowSchema } from "./workflowSchemas";
import { startCreateProductWizard } from "../llm/wizards/createProductWizard/handler";
import { startUpdateProductWizard } from "../llm/wizards/updateProductWizard/handler";
import { startBulkUpdateWizard } from "../llm/wizards/bulkUpdateWizard/handler";

function session(ctx?: ToolCtx): string {
  if (!ctx?.client || !ctx.sessionKey) throw new Error("Authenticated conversation required");
  return ctx.sessionKey;
}
const reply = (text: string): MCPToolResponse => ({ content: [{ type: "text", text }] });

export function registerWorkflowTools(server: McpServer) {
  registerChatTool(server, "prepare_create_product", {
    description: "Prepare a product creation preview using data containing EVERY detail already supplied by the user. If a name is known, pass it and all known fields in data; never make the user choose wizard/JSON or repeat those details. Missing optional fields may be omitted. Creates default to draft. When no name is known, call this tool with the known data or an empty object to persist the missing-name question; never ask for the name only in prose. Set guided=true only for an explicitly requested step-by-step wizard. No product is created until separate confirmation.",
    inputSchema: z.object({ data: productChangesSchema.optional(), guided: z.boolean().optional() }).strict(), chat: { terminal: true }
  }, async (args, ctx) => {
    const key = session(ctx);
    if (args.guided) return reply(startCreateProductWizard(key,{guided:true,data:args.data}));
    if (!args.data?.name) return reply(askProductName(key,args.data || {}));
    return reply(await prepareCatalogChange({...ctx,sessionKey:key}, {resource:"product"}, "create", args.data));
  });

  registerChatTool(server, "prepare_product_update", {
    description: "Prepare an update for ONE product identified by ID or SKU. For a percentage price change use priceAdjustment, never the bulk tool. Include changes explicitly requested by the user; omit unknown fields. For an image URL use imageChange: replace_featured keeps the remaining gallery; append adds images; replace_gallery replaces all; remove deletes selected gallery images; clear removes all. Never replace the whole gallery unless requested. For clearing nullable dates or customs fields with explicit null use prepare_catalog_change.data_json, which preserves null exactly. Category/tag/brand arrays require real term IDs. Fetch/search first if the target is unclear. Shows a preview or asks for missing fields; never writes until user confirmation.",
    inputSchema: updateWorkflowSchema, chat: { terminal: true }
  }, async (args, ctx) => {
    const key = session(ctx);
    if (!args.id && !args.sku) return reply("Which product should I update? Please provide its ID or SKU.");
    if (args.id && args.sku) return reply("Please identify the product using either its ID or SKU.");
    const result = await startUpdateProductWizard(key, args, ctx);
    return reply(result.reply);
  });

  registerChatTool(server, "prepare_bulk_product_update", {
    description: "Prepare the SAME field change for all products or one category. Set scope=all only when explicitly requested. Supports setting a value or percentage changes to regular_price, sale_price, stock_quantity. Asks for missing information and requires confirmation before writes.",
    inputSchema: bulkWorkflowSchema, chat: { terminal: true }
  }, async (args, ctx) => {
    const key = session(ctx);
    if (args.operation === "decrease_percent" && args.percent > 100) {
      return reply("A percentage decrease must be at most 100%.");
    }
    const result = await startBulkUpdateWizard(key, args, ctx);
    return reply(result.reply);
  });
}
