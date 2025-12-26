// src/app.ts
import express from "express";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createAppRouter } from "./routes/appRouter.js";
import { corsMiddleware } from "./middleware/cors.js";

export function createApp(server: McpServer) {
  const app = express();

  
  app.use(corsMiddleware);

  app.disable("x-powered-by");
  app.use(express.json());
  app.use(express.static("public"));

  app.use("/", createAppRouter(server));

  return app;
}
