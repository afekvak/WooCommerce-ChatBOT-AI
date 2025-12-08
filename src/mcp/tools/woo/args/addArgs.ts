// src/mcp/woo/args/addArgs.ts
import type { z } from "zod";                              // מייבא את טיפוס z לסוגים בלבד
import { wooCreateProductSchema } from "../wooSchemas/addSchemas"; // מייבא את סכמת יצירת המוצר

export type WooCreateProductArgs = z.infer<                // מגדיר טיפוס קלט ליצירת מוצר מתוך סכמת Zod
  typeof wooCreateProductSchema                            // משתמש בסכמת wooCreateProductSchema כדי לגזור את השדות
>;                                                         // סוף הגדרת הטיפוס
