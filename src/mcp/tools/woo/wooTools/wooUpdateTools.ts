// src/mcp/woo/wooTools/wooUpdateTools.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import type { MCPToolResponse } from "../../../types";
import { registeredTools } from "../../registry";

import {
  WooUpdateProductByIdArgs,
  WooUpdateProductBySkuArgs
} from "../args/updateArgs";

import {
  wooUpdateProductByIdSchema,
  wooUpdateProductBySkuSchema
} from "../wooSchemas/updateSchemas";

import {
  updateProduct,
  updateProductBySku
} from "../../../../controllers/wooUpdateController";

import { formatSingleProduct } from "../../../../utils/formatWoo";

import type { ToolCtx } from "../../../types";
import { resolveWooCredentials } from "../wooCredentials.js";

export function registerWooUpdateTools(server: McpServer) {
  // UPDATE PRODUCT BY ID
  const updateProductByIdHandler = async (
    args: WooUpdateProductByIdArgs,
    ctx?: ToolCtx
  ): Promise<MCPToolResponse> => {
    try {
      const { url, ck, cs } = resolveWooCredentials(args, ctx);

      const updated = await updateProduct(
        url,
        ck,
        cs,
        args.id,
        args.payload
      );
      const html = formatSingleProduct(updated);

      return {
        content: [{ type: "text", text: html }]
      };
    } catch (err: any) {
      const resolvedUrl =
        (args as any).url ??
        ctx?.client?.wooUrl ??
        process.env.WOO_URL ??
        "none";

      return {
        content: [
          {
            type: "text",
            text: `❌ Error in woo_update_product_by_id: ${err.message} (resolvedUrl=${resolvedUrl})`
          }
        ]
      };
    }
  };

  server.registerTool(
    "woo_update_product_by_id",
    {
      title: "WooCommerce Update Product By ID",
      description: "Update fields of a WooCommerce product by numeric ID.",
      inputSchema: wooUpdateProductByIdSchema as any
    } as any,
    updateProductByIdHandler as any
  );

  registeredTools["woo_update_product_by_id"] = {
    handler: updateProductByIdHandler as any
  };

  // UPDATE PRODUCT BY SKU
  const updateProductBySkuHandler = async (
    args: WooUpdateProductBySkuArgs,
    ctx?: ToolCtx
  ): Promise<MCPToolResponse> => {
    try {
      const { url, ck, cs } = resolveWooCredentials(args, ctx);

      const updated = await updateProductBySku(
        url,
        ck,
        cs,
        args.sku,
        args.payload
      );
      const html = formatSingleProduct(updated);

      return {
        content: [{ type: "text", text: html }]
      };
    } catch (err: any) {
      const resolvedUrl =
        (args as any).url ??
        ctx?.client?.wooUrl ??
        process.env.WOO_URL ??
        "none";

      return {
        content: [
          {
            type: "text",
            text: `❌ Error in woo_update_product_by_sku: ${err.message} (resolvedUrl=${resolvedUrl})`
          }
        ]
      };
    }
  };

  server.registerTool(
    "woo_update_product_by_sku",
    {
      title: "WooCommerce Update Product By SKU",
      description:
        "Update fields of a WooCommerce product by SKU. Internally resolves the product and then updates it by ID.",
      inputSchema: wooUpdateProductBySkuSchema as any
    } as any,
    updateProductBySkuHandler as any
  );

  registeredTools["woo_update_product_by_sku"] = {
    handler: updateProductBySkuHandler as any
  };
}
