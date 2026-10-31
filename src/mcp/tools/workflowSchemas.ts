import { z } from "zod";

import {productChangesSchema, imageChangeSchema} from "../../services/productSchema";
export const updateChangesSchema = productChangesSchema;

export const bulkFields = [
  "regular_price", "sale_price", "status", "stock_status", "manage_stock",
  "stock_quantity", "backorders", "catalog_visibility", "featured",
  "reviews_allowed", "purchase_note", "tax_status", "tax_class"
] as const;

export const updateWorkflowSchema = z.object({
  id: z.number().int().positive().optional(),
  sku: z.string().min(1).optional(),
  changes: updateChangesSchema.optional(),
  imageChange: imageChangeSchema.optional(),
  priceAdjustment: z.object({ field: z.enum(["regular_price", "sale_price"]), direction: z.enum(["increase", "decrease"]), percent: z.number().positive().max(1000) }).strict().describe("Percentage change for this ONE product; computed from its fresh price before confirmation. Do not also set this price in changes.").optional()
}).strict();

export const bulkWorkflowSchema = z.object({
  scope: z.enum(["all", "category"]).optional(),
  categoryId: z.number().int().positive().optional(),
  category: z.string().min(1).optional(),
  field: z.enum(bulkFields).optional(),
  operation: z.enum(["set", "increase_percent", "decrease_percent"]).optional(),
  percent: z.number().positive().max(1000).optional(),
  value: z.union([z.string(), z.number(), z.boolean()]).optional()
}).strict();
