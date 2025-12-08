// src/mcp/woo/wooSchemas/getSchemas.ts
import { z } from "zod";                                   
import { wooConnectionSchema } from "./connectionSchema.js"; 

// 1) Get all products
export const wooGetProductsSchema = wooConnectionSchema.extend({
  limit: z.union([z.number().int().positive(), z.string()]).optional()
});

// 2) Get product by ID
export const wooGetProductByIdSchema = wooConnectionSchema.extend({
  id: z.union([z.number().int().positive(), z.string()])
});

// 3) Get product by SKU
export const wooGetProductBySkuSchema = wooConnectionSchema.extend({
  sku: z.string()
});

// 4) Get products by name
export const wooGetProductsByNameSchema = wooConnectionSchema.extend({
  name: z.string().optional(),
  limit: z.union([z.number().int().positive(), z.string()]).optional()
});

// 5) Get products by category (id or slug)
export const wooGetProductsByCategorySchema = wooConnectionSchema.extend({
  categoryId: z.union([z.number().int().positive(), z.string()]).optional(),
  category: z.string().optional(),
  limit: z.union([z.number().int().positive(), z.string()]).optional()
});
