// src/server.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"; // model context protocol server 
import { createApp } from "./app.js"; // function to create the express app from app.ts

import dotenv from "dotenv"; // load .env variables
import http from "node:http"; // http server

import { setupAllTools } from "./mcp/tools/index.js"; // load all MCP tools
import { setupResources } from "./mcp/resources.js"; // load MCP resources
import { setupPrompts } from "./mcp/prompts.js"; // load MCP prompts
import { setupLLMTool } from "./mcp/server/setupLLMTool.js"; // load LLM tool



dotenv.config(); // load .env variables

const server = new McpServer({  // MCP Server Configuration 
  name: "woo-mcp-server",
  version: "1.0.0"
});
setupLLMTool(server); // load llm tool
setupAllTools(server);  // load all tools



const app = createApp(server); // create the express app with the MCP server

const port = parseInt(process.env.PORT || "3000", 10);

const httpServer = http.createServer(app); // run HTTP server with the express app

httpServer.listen(port, () => {  // start listening on the specified port
  console.log(`🚀 MCP Server running at http://localhost:${port}/mcp`);
});

httpServer.on("error", err => { // handle server errors
  console.error("Server error:", err);
  process.exit(1);
});


// how it works:
// - imports necessary modules and functions
// - loads environment variables from .env file
// - creates an MCP server instance with name and version
// - loads LLM tool and other tools into the server
// - creates an express app using the function from app.ts with the MCP server

// - sets up an HTTP server with the app to listen on the specified port and handle incoming requests
