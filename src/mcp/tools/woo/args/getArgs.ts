// src/mcp/woo/args/getArgs.ts
import type { z } from "zod";

import {
  wooGetProductsSchema,
  wooGetProductByIdSchema,
  wooGetProductBySkuSchema,
  wooGetProductsByNameSchema,
  wooGetProductsByCategorySchema
} from "../wooSchemas/getSchemas";

// 1) Get all products
export type WooGetProductsArgs = z.infer<typeof wooGetProductsSchema>;

// 2) Get product by ID
export type WooGetProductByIdArgs = z.infer<typeof wooGetProductByIdSchema>;

// 3) Get product by SKU
export type WooGetProductBySkuArgs = z.infer<typeof wooGetProductBySkuSchema>;

// 4) Get products by name
export type WooGetProductsByNameArgs = z.infer<
  typeof wooGetProductsByNameSchema
>;

// 5) Get products by category
export type WooGetProductsByCategoryArgs = z.infer<
  typeof wooGetProductsByCategorySchema
>;
