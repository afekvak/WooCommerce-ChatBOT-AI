// src/mcp/llm/woo/args/updateArgs.ts
import { z } from "zod";
import { wooUpdateProductByIdSchema, wooUpdateProductBySkuSchema } from "../wooSchemas/updateSchemas";

// 1) Update product by ID
export type WooUpdateProductByIdArgs = z.infer<typeof wooUpdateProductByIdSchema>;
export type WooUpdateProductBySkuArgs = z.infer<typeof wooUpdateProductBySkuSchema>;
