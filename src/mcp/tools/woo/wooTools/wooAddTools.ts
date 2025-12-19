// src/mcp/woo/wooTools/wooAddTools.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import type { TextContent } from "@modelcontextprotocol/sdk/types.js";
import type { MCPToolResponse } from "../../../types";
import { registeredTools } from "../../registry";

import { createProduct } from "../../../../controllers/wooAddController";
import { formatSingleProduct } from "../../../../utils/formatWoo";

import { wooCreateProductSchema } from "../wooSchemas/addSchemas";
import { WooCreateProductArgs } from "../args/addArgs";

import type { ToolCtx } from "../../../types";
import { resolveWooCredentials } from "../wooCredentials.js";

export function registerWooAddTools(server: McpServer) {
  const handler = async (
    args: WooCreateProductArgs,
    ctx?: ToolCtx
  ): Promise<MCPToolResponse> => {
    try {
      const { url, ck, cs } = resolveWooCredentials(args, ctx);

      const product = await createProduct(url, ck, cs, args.data);
      const html = formatSingleProduct(product);

      const block: TextContent = {
        type: "text",
        text: html
      };

      return { content: [block] };
    } catch (err: any) {
      // helpful extra: include resolved URL hint in error text
      const resolvedUrl =
        (args as any).url ??
        ctx?.client?.wooUrl ??
        process.env.WOO_URL ??
        "none";

      return {
        content: [
          {
            type: "text",
            text: `❌ Error creating product: ${err.message} (resolvedUrl=${resolvedUrl})`
          }
        ]
      };
    }
  };

  server.registerTool(
    "woo_create_product",
    {
      title: "WooCommerce Create Product",
      description: "Creates a new WooCommerce product.",
      inputSchema: wooCreateProductSchema as any
    } as any,
    handler as any
  );

  registeredTools["woo_create_product"] = {
    handler
  };
}
