// src/mcp/tools/index.ts
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";

import { registerDateTool } from "./global/dateTool.js";
import { registerWooGetTools } from "./woo/wooTools/wooGetTools.js";
// If you have post/delete/add tools uncomment later:
 import { registerWooUpdateTools } from "./woo/wooTools/wooUpdateTools.js";
 import { registerWooDeleteTools } from "./woo/wooTools/wooDeleteTools.js";
 import { registerWooAddTools } from "./woo/wooTools/wooAddTools.js";

export function setupAllTools(server: McpServer) {
  // GLOBAL
  registerDateTool(server);

  // WOO GET TOOLS
  registerWooGetTools(server);

  // Uncomment when ready:
  registerWooUpdateTools(server);
  registerWooDeleteTools(server);
  registerWooAddTools(server);
}
