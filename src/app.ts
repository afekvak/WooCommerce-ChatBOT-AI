// src/app.ts
import express from "express";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createAppRouter } from "./routes/appRouter.js";
import { corsMiddleware } from "./middleware/cors.js";

export function createApp(server: McpServer) { // create the express app (accepts the MCP server)
  const app = express(); // create an express app

  
  app.use(corsMiddleware); // load CORS middleware

  app.disable("x-powered-by"); // disable Express header for security
  app.use(express.json()); // parse JSON request bodies
  app.use(express.static("public")); // serve static files from the "public" directory

  app.use("/", createAppRouter(server)); // setup a router for the app with the MCP server

  return app; // return the configured express app to the server
}


// how it works:
// - creates an express app
// - applies CORS middleware
// - disables x-powered-by header for security
// - parses JSON request bodies
// - serves static files from the "public" directory

// - call createAppRouter function from appRouter.ts with the MCP server to create the main app router with all endpoints 
// - returns the configured express app to be used by the server