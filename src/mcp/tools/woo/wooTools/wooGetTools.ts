// src/mcp/woo/wooTools/wooGetTools.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import type { MCPToolResponse } from "../../../types";
import { registeredTools } from "../../registry";

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
} from "../../../../controllers/wooGetController";

import {
  formatProducts,
  formatSingleProduct,
  formatProductBySku
} from "../../../../utils/formatWoo";

export function registerWooGetTools(server: McpServer) {
  // ==========================
  // GET ALL PRODUCTS
  // ==========================
  const getProductsHandler = async (
    { url, ck, cs, limit }: WooGetProductsArgs
  ): Promise<MCPToolResponse> => {
    try {
      const finalUrl = url ?? process.env.WOO_URL!;
      const finalCk = ck ?? process.env.WOO_CK!;
      const finalCs = cs ?? process.env.WOO_CS!;

      const products = await getProducts(finalUrl, finalCk, finalCs, limit);
      const html = formatProducts(products);

      return { content: [{ type: "text", text: html }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `❌ Error: ${err.message}` }] };
    }
  };

  server.registerTool(
    "woo_get_products",
    {
      title: "WooCommerce Get Products",
      description: "Fetches WooCommerce products",
      inputSchema: wooGetProductsSchema as any
    } as any,
    getProductsHandler as any
  );

  registeredTools["woo_get_products"] = {
    handler: getProductsHandler as any
  };

  // ==========================
  // GET PRODUCT BY ID
  // ==========================
  const getProductByIdHandler = async (
    { url, ck, cs, id }: WooGetProductByIdArgs
  ): Promise<MCPToolResponse> => {
    try {
      const finalUrl = url ?? process.env.WOO_URL!;
      const finalCk = ck ?? process.env.WOO_CK!;
      const finalCs = cs ?? process.env.WOO_CS!;

      const pid = typeof id === "string" ? parseInt(id, 10) : id;

      if (!pid || Number.isNaN(pid)) {
        return { content: [{ type: "text", text: "❌ Invalid product ID." }] };
      }

      const product = await getProductById(finalUrl, finalCk, finalCs, pid);
      const html = formatSingleProduct(product);

      return { content: [{ type: "text", text: html }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `❌ Error: ${err.message}` }] };
    }
  };

  server.registerTool(
    "woo_get_product_by_id",
    {
      title: "WooCommerce Get Product By ID",
      description: "Fetch a single product",
      inputSchema: wooGetProductByIdSchema as any
    } as any,
    getProductByIdHandler as any
  );

  registeredTools["woo_get_product_by_id"] = {
    handler: getProductByIdHandler as any
  };

  // ==========================
  // GET PRODUCT BY SKU
  // ==========================
  const getProductBySkuHandler = async (
    { url, ck, cs, sku }: WooGetProductBySkuArgs
  ): Promise<MCPToolResponse> => {
    try {
      const finalUrl = url ?? process.env.WOO_URL!;
      const finalCk = ck ?? process.env.WOO_CK!;
      const finalCs = cs ?? process.env.WOO_CS!;

      const skuValue = typeof sku === "string" ? sku.trim() : "";

      if (!skuValue) {
        return {
          content: [{ type: "text", text: "❌ Invalid SKU." }]
        };
      }

      const products = await getProductBySku(
        finalUrl,
        finalCk,
        finalCs,
        skuValue
      );

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
        content: [{ type: "text", text: `❌ Error: ${err.message}` }]
      };
    }
  };

  server.registerTool(
    "woo_get_product_by_sku",
    {
      title: "WooCommerce Get Product By SKU",
      description: "Fetch a single product using its SKU",
      inputSchema: wooGetProductBySkuSchema as any
    } as any,
    getProductBySkuHandler as any
  );

  registeredTools["woo_get_product_by_sku"] = {
    handler: getProductBySkuHandler as any
  };

  // ==========================
  // GET PRODUCTS BY NAME
  // ==========================
  const getProductsByNameHandler = async (
  { url, ck, cs, name, limit }: WooGetProductsByNameArgs
): Promise<MCPToolResponse> => {
  try {
    const finalUrl = url ?? process.env.WOO_URL!;
    const finalCk = ck ?? process.env.WOO_CK!;
    const finalCs = cs ?? process.env.WOO_CS!;

    const searchTerm = (name ?? "").toString().trim();

    if (!searchTerm) {
      return {
        content: [
          { type: "text", text: "❌ Missing product name to search." }
        ]
      };
    }

    const products = await getProductByName(
      finalUrl,
      finalCk,
      finalCs,
      searchTerm,
      limit                    // <- pass raw limit (string | number | undefined)
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
      content: [
        {
          type: "text",
          text: `❌ Error in getProductsByName: ${err.message}`
        }
      ]
    };
  }
};


  server.registerTool(
    "woo_get_products_by_name",
    {
      title: "WooCommerce Get Products By Name",
      description:
        "Search WooCommerce products by name and return matching products as cards.",
      inputSchema: wooGetProductsByNameSchema as any
    } as any,
    getProductsByNameHandler as any
  );

  registeredTools["woo_get_products_by_name"] = {
    handler: getProductsByNameHandler as any
  };

  // ==========================
  // GET PRODUCTS BY CATEGORY
  // ==========================
  const getProductsByCategoryHandler = async (
  { url, ck, cs, categoryId, category, limit }: WooGetProductsByCategoryArgs
): Promise<MCPToolResponse> => {
  try {
    const finalUrl = url ?? process.env.WOO_URL!;
    const finalCk = ck ?? process.env.WOO_CK!;
    const finalCs = cs ?? process.env.WOO_CS!;

    const finalCategory = categoryId ?? category;

    if (!finalCategory) {
      return {
        content: [
          {
            type: "text",
            text: "❌ Error: categoryId or category (slug) is required"
          }
        ]
      };
    }

    const products = await getProductsByCategory(
      finalUrl,
      finalCk,
      finalCs,
      finalCategory,      // <- number | string | undefined
      limit               // <- number | string | undefined
    );

    const html = formatProducts(products);

    return { content: [{ type: "text", text: html }] };
  } catch (err: any) {
    return {
      content: [{ type: "text", text: `❌ Error: ${err.message}` }]
    };
  }
};


  server.registerTool(
    "woo_get_products_by_category",
    {
      title: "WooCommerce Get Products by Category",
      description:
        "Fetches WooCommerce products filtered by category ID or slug",
      inputSchema: wooGetProductsByCategorySchema as any
    } as any,
    getProductsByCategoryHandler as any
  );

  registeredTools["woo_get_products_by_category"] = {
    handler: getProductsByCategoryHandler as any
  };
}
