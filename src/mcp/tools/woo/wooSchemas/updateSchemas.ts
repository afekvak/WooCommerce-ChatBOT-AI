// src/mcp/llm/woo/wooSchemas/updateSchemas.ts
import { z } from "zod";
import { wooConnectionSchema } from "./connectionSchema";

// 1) Update product by ID
export const wooUpdateProductByIdSchema = wooConnectionSchema.extend({
  id: z.union([z.number().int().positive(), z.string()]),
  // payload is a partial Woo product, wizard will build it
  payload: z.record(z.any())
});

// Update product by SKU
export const wooUpdateProductBySkuSchema = wooConnectionSchema.extend({
  sku: z.string().min(1),          // SKU like "headphones-222"
  payload: z.record(z.any(), z.any())
});