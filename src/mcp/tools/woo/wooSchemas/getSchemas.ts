// src/mcp/woo/wooSchemas/getSchemas.ts
import { z } from "zod";                                   
import { wooConnectionSchema } from "./connectionSchema.js"; 

const positiveId = z.union([z.number().int().positive().max(Number.MAX_SAFE_INTEGER), z.string().regex(/^[1-9]\d*$/)]);

// 1) Get all products
export const wooGetProductsSchema = wooConnectionSchema.extend({
  limit: z.union([z.number().int().positive(), z.string()]).optional()
});

// 2) Get product by ID
export const wooGetProductByIdSchema = wooConnectionSchema.extend({
  id: positiveId
});

// 3) Get product by SKU
export const wooGetProductBySkuSchema = wooConnectionSchema.extend({
  sku: z.string().trim().min(1)
});

// 4) Get products by name
export const wooGetProductsByNameSchema = wooConnectionSchema.extend({
  name: z.string().trim().min(1),
  limit: z.union([z.number().int().positive(), z.string()]).optional()
});

// 5) Get products by category (id or slug)
export const wooGetProductsByCategorySchema = wooConnectionSchema.extend({
  categoryId: positiveId.optional(),
  category: z.string().trim().min(1).optional(),
  limit: z.union([z.number().int().positive(), z.string()]).optional()
});
