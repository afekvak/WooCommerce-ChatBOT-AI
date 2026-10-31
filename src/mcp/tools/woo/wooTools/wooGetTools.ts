// src/mcp/woo/wooTools/wooGetTools.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import type { MCPToolResponse } from "../../../types";
import { registerTool } from "../../registry";

import {
  WooGetProductsArgs,
  WooGetProductByIdArgs,
  WooGetProductBySkuArgs,
  WooGetProductsByNameArgs,
  WooGetProductsByCategoryArgs
} from "../args/getArgs";

import {
  wooGetProductsSchema,
  wooGetProductByIdSchema,
  wooGetProductBySkuSchema,
  wooGetProductsByNameSchema,
  wooGetProductsByCategorySchema
} from "../wooSchemas/getSchemas";

import {
  getProducts,
  getProductById,
  getProductBySku,
  getProductsByCategory,
  getProductByName
} from "../../../../services/productService";

import {
  formatProducts,
  formatSingleProduct,
  formatProductBySku
} from "../../../../utils/formatWoo";

import type { ToolCtx } from "../../../types";
import { resolveWooCredentials } from "../wooCredentials.js";

export function registerWooGetTools(server: McpServer) {
  // GET ALL PRODUCTS
  const getProductsHandler = async (
    args: WooGetProductsArgs,
    ctx?: ToolCtx
  ): Promise<MCPToolResponse> => {
    try {
      const { url, ck, cs } = resolveWooCredentials(args, ctx);

      const products = await getProducts(url, ck, cs, args.limit);
      const html = formatProducts(products);

      return { content: [{ type: "text", text: html }] };
    } catch (err: any) {
      return { isError: true, content: [{ type: "text", text: `❌ Error: ${err.message}` }] };
    }
  };

  registerTool(server,
    "woo_get_products",
    {
      title: "WooCommerce Get Products",
      description: "Fetches WooCommerce products",
      chat: {},
      inputSchema: wooGetProductsSchema as any
    } as any,
    getProductsHandler as any
  );


  // GET PRODUCT BY ID
  const getProductByIdHandler = async (
    args: WooGetProductByIdArgs,
    ctx?: ToolCtx
  ): Promise<MCPToolResponse> => {
    try {
      const { url, ck, cs } = resolveWooCredentials(args, ctx);

      const pid =
        typeof args.id === "string" ? parseInt(args.id, 10) : args.id;

      if (!pid || Number.isNaN(pid)) {
        return { content: [{ type: "text", text: "❌ Invalid product ID." }] };
      }

      const product = await getProductById(url, ck, cs, pid);
      const html = formatSingleProduct(product);

      return { content: [{ type: "text", text: html }] };
    } catch (err: any) {
      return { isError: true, content: [{ type: "text", text: `❌ Error: ${err.message}` }] };
    }
  };

  registerTool(server,
    "woo_get_product_by_id",
    {
      title: "WooCommerce Get Product By ID",
      description: "Fetch a single product",
      chat: {},
      inputSchema: wooGetProductByIdSchema as any
    } as any,
    getProductByIdHandler as any
  );


  // GET PRODUCT BY SKU
  const getProductBySkuHandler = async (
    args: WooGetProductBySkuArgs,
    ctx?: ToolCtx
  ): Promise<MCPToolResponse> => {
    try {
      const { url, ck, cs } = resolveWooCredentials(args, ctx);

      const skuValue = typeof args.sku === "string" ? args.sku.trim() : "";

      if (!skuValue) {
        return {
          isError: true,
          content: [{ type: "text", text: "❌ Invalid SKU." }]
        };
      }

      const products = await getProductBySku(url, ck, cs, skuValue);

      if (!Array.isArray(products) || products.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `❌ No products found with SKU: ${skuValue}`
            }
          ]
        };
      }

      const product = products[0];
      const html = formatProductBySku(product);

      return { content: [{ type: "text", text: html }] };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: "text", text: `❌ Error: ${err.message}` }]
      };
    }
  };

  registerTool(server,
    "woo_get_product_by_sku",
    {
      title: "WooCommerce Get Product By SKU",
      description: "Fetch a single product using its SKU",
      chat: {},
      inputSchema: wooGetProductBySkuSchema as any
    } as any,
    getProductBySkuHandler as any
  );


  // GET PRODUCTS BY NAME
  const getProductsByNameHandler = async (
    args: WooGetProductsByNameArgs,
    ctx?: ToolCtx
  ): Promise<MCPToolResponse> => {
    try {
      const { url, ck, cs } = resolveWooCredentials(args, ctx);

      const searchTerm = (args.name ?? "").toString().trim();

      if (!searchTerm) {
        return {
          isError: true,
          content: [
            { type: "text", text: "❌ Missing product name to search." }
          ]
        };
      }

      const products = await getProductByName(
        url,
        ck,
        cs,
        searchTerm,
        args.limit
      );

      if (!Array.isArray(products) || products.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No products found matching "${searchTerm}".`
            }
          ]
        };
      }

      const html = formatProducts(products);

      return { content: [{ type: "text", text: html }] };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `❌ Error in getProductsByName: ${err.message}`
          }
        ]
      };
    }
  };

  registerTool(server,
    "woo_get_products_by_name",
    {
      title: "WooCommerce Get Products By Name",
      description:
        "Search WooCommerce products by name and return matching products as cards.",
      chat: {},
      inputSchema: wooGetProductsByNameSchema as any
    } as any,
    getProductsByNameHandler as any
  );


  // GET PRODUCTS BY CATEGORY
  const getProductsByCategoryHandler = async (
    args: WooGetProductsByCategoryArgs,
    ctx?: ToolCtx
  ): Promise<MCPToolResponse> => {
    try {
      const { url, ck, cs } = resolveWooCredentials(args, ctx);

      const finalCategory = args.categoryId != null ? Number(args.categoryId) : args.category;

      if (!finalCategory) {
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: "❌ Error: categoryId or category (slug) is required"
            }
          ]
        };
      }

      const products = await getProductsByCategory(
        url,
        ck,
        cs,
        finalCategory,
        args.limit
      );

      const html = formatProducts(products);

      return { content: [{ type: "text", text: html }] };
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: "text", text: `❌ Error: ${err.message}` }]
      };
    }
  };

  registerTool(server,
    "woo_get_products_by_category",
    {
      title: "WooCommerce Get Products by Category",
      description:
        "Fetches WooCommerce products filtered by category ID or slug",
      chat: {},
      inputSchema: wooGetProductsByCategorySchema as any
    } as any,
    getProductsByCategoryHandler as any
  );

}
