// src/mcp/woo/wooSchemas/addSchemas.ts
import { z } from "zod";                                   
import { wooConnectionSchema } from "./connectionSchema.js"; 
                                                   

export const wooCreateProductSchema = wooConnectionSchema.extend({
  data: z.any()                                          
});                                                         
