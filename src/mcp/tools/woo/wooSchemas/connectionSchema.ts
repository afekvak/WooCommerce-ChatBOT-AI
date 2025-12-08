import { z } from "zod";                                   // מייבא את Zod להגדרת סכמות ולוולידציה

export const wooConnectionSchema = z.object({                     // סכמת בסיס לחיבור לחנות WooCommerce
  url: z.string().url().optional(),                        // שדה url אופציונלי עם ולידציה של כתובת אינטרנט
  ck: z.string().optional(),                               // שדה ck אופציונלי למפתח consumer key
  cs: z.string().optional()                                // שדה cs אופציונלי ל consumer secret
}); 