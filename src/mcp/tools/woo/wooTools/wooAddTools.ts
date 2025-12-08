// src/mcp/woo/wooTools/wooAddTools.ts
import { z } from "zod";                                              // מייבא את Zod (כבר לא חובה כאן, אבל אפשר להשאיר אם משתמשים בעוד מקומות)
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp"; // טיפוס שרת MCP לחתימת פונקציית הרישום
import type { TextContent } from "@modelcontextprotocol/sdk/types.js"; // טיפוס תוכן טקסט בלוק לתשובות MCP
import type { MCPToolResponse } from "../../../types";                // טיפוס כללי לתשובת כלי MCP מהפרויקט שלך
import { registeredTools } from "../../registry";                     // רישום הכלים הפנימי שבו נשמור את ה handler

import { createProduct } from "../../../../controllers/wooAddController"; // פונקציה שיוצרת מוצר חדש ב WooCommerce
import { formatSingleProduct } from "../../../../utils/formatWoo";    // פונקציה שמעצבת מוצר בודד ל HTML להצגה בצ׳אט

import { wooCreateProductSchema } from "../wooSchemas/addSchemas";    // סכמת Zod לקלט של כלי יצירת מוצר
import { WooCreateProductArgs } from "../args/addArgs";          // טיפוס הקלט לכלי יצירת מוצר שנגזר מהסכמה

export function registerWooAddTools(server: McpServer) {              // פונקציה שרושמת את כל כלי ההוספה (add) על שרת MCP
  
  const handler = async (                                             // מגדיר handler אסינכרוני לכלי woo_create_product
    { url, ck, cs, data }: WooCreateProductArgs                       // קולט את כל שדות הקלט לפי טיפוס WooCreateProductArgs
  ): Promise<MCPToolResponse> => {                                    // מחזיר הבטחה שמכילה MCPToolResponse
    try {                                                             // מתחיל בלוק try לטיפול בשגיאות
      const finalUrl = url ?? process.env.WOO_URL!;                   // אם לא נשלח url משתמשים בערך מהסביבה
      const finalCk = ck ?? process.env.WOO_CK!;                      // אם לא נשלח ck משתמשים ב consumer key מהסביבה
      const finalCs = cs ?? process.env.WOO_CS!;                      // אם לא נשלח cs משתמשים ב consumer secret מהסביבה

      const product = await createProduct(                            // קורא לפונקציה שיוצרת את המוצר ב WooCommerce
        finalUrl,                                                     // כתובת הבסיס של ה API
        finalCk,                                                      // consumer key לחיבור
        finalCs,                                                      // consumer secret לחיבור
        data                                                          // אובייקט המוצר הגולמי שהמודל שלח
      );                                                              // סוף הקריאה ל createProduct

      const html = formatSingleProduct(product);                      // ממיר את אובייקט המוצר ל HTML יפה להצגה בצ׳אט

      const block: TextContent = {                                    // יוצר בלוק תוכן מסוג טקסט עבור תשובת MCP
        type: "text",                                                 // סוג הבלוק הוא טקסט
        text: html                                                    // מגדיר את ה HTML כשדה הטקסט של הבלוק
      };                                                              // סוף הגדרת הבלוק

      return { content: [block] };                                    // מחזיר תשובת MCP עם מערך שמכיל את בלוק הטקסט
    } catch (err: any) {                                              // תופס חריגה במקרה של שגיאה בזמן יצירת המוצר
      return {                                                        // מחזיר תשובת שגיאה למודל ולמשתמש
        content: [                                                    // מערך בלוקים בתשובה
          {                                                           // בלוק טקסט יחיד
            type: "text",                                             // מציין שזה בלוק טקסט
            text: `❌ Error creating product: ${err.message}`         // כותב הודעת שגיאה הכוללת את message מהחריגה
          }                                                           // סוף בלוק הטקסט
        ]                                                             // סוף מערך ה content
      };                                                              // סוף תשובת השגיאה
    }                                                                 // סוף בלוק catch
  };                                                                  // סוף הגדרת ה handler

  server.registerTool(                                                // רושם את כלי woo_create_product בשרת MCP
    "woo_create_product",                                             // שם הכלי שבו המודל ישתמש
    {
      title: "WooCommerce Create Product",                            // כותרת ידידותית לכלי
      description: "Creates a new WooCommerce product.",              // תיאור קצר של מה שהכלי מבצע
      inputSchema: wooCreateProductSchema as any                      // מעביר את סכמת הקלט תוך המרה ל any כדי לקצר את הגנריקה
    } as any,                                                         // ממיר גם את אובייקט ההגדרה ל any כדי להקל על TypeScript
    handler as any                                                    // ממיר את ה handler ל any כדי שלא יכריח התאמה לגנריקה העמוקה של SDK
  );                                                                  // סוף קריאת registerTool

  registeredTools["woo_create_product"] = {                           // מוסיף את כלי יצירת המוצר גם לרישום הפנימי registeredTools
    handler                                                           // שומר את ה handler כפי שהוא, הרישום משתמש בו בזמן ריצה
  };                                                                  // סוף הגדרת האובייקט ב registeredTools
}                                                                     // סוף פונקציית registerWooAddTools
