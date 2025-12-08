// src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createApp } from "./app.js";

import dotenv from "dotenv";
import http from "node:http";

import { setupAllTools } from "./mcp/tools/index.js";
import { setupResources } from "./mcp/resources.js";
import { setupPrompts } from "./mcp/prompts.js";
import { setupLLMTool } from "./mcp/server/setupLLMTool.js";



dotenv.config();

const server = new McpServer({ 
  name: "woo-mcp-server",
  version: "1.0.0"
});
setupLLMTool(server);
setupAllTools(server); 



const app = createApp(server); 

const port = parseInt(process.env.PORT || "3000", 10);

const httpServer = http.createServer(app);

httpServer.listen(port, () => {
  console.log(`🚀 MCP Server running at http://localhost:${port}/mcp`);
});

httpServer.on("error", err => {
  console.error("Server error:", err);
  process.exit(1);
});
