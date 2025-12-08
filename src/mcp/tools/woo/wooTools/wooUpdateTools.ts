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

import {
  formatSingleProduct
} from "../../../../utils/formatWoo";

export function registerWooUpdateTools(server: McpServer) {
  // ==========================
  // UPDATE PRODUCT BY ID
  // ==========================
  const updateProductByIdHandler = async (
    { url, ck, cs, id, payload }: WooUpdateProductByIdArgs
  ): Promise<MCPToolResponse> => {
    try {
      const finalUrl = url ?? process.env.WOO_URL!;
      const finalCk = ck ?? process.env.WOO_CK!;
      const finalCs = cs ?? process.env.WOO_CS!;

      const updated = await updateProduct(finalUrl, finalCk, finalCs, id, payload);
      const html = formatSingleProduct(updated);

      return {
        content: [{ type: "text", text: html }]
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `❌ Error in woo_update_product_by_id: ${err.message}` }]
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


  // ==========================
  // UPDATE PRODUCT BY SKU
  // ==========================
  const updateProductBySkuHandler = async (
    { url, ck, cs, sku, payload }: WooUpdateProductBySkuArgs
  ): Promise<MCPToolResponse> => {
    try {
      const finalUrl = url ?? process.env.WOO_URL!;
      const finalCk = ck ?? process.env.WOO_CK!;
      const finalCs = cs ?? process.env.WOO_CS!;

      const updated = await updateProductBySku(finalUrl, finalCk, finalCs, sku, payload);
      const html = formatSingleProduct(updated);

      return {
        content: [{ type: "text", text: html }]
      };
    } catch (err: any) {
      return {
        content: [
          {
            type: "text",
            text: `❌ Error in woo_update_product_by_sku: ${err.message}`
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
}

  


