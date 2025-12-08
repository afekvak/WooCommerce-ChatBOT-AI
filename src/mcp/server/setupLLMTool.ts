// src/mcp/server/setupLLMTool.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { handleUserMessage } from "../llm/router.js";

export const registeredTools: any = {};

export function setupLLMTool(server: McpServer) {

  // Make sure registry exists
  if (!(server as any).tools) (server as any).tools = {};

  // Wrap only ONE TIME
  if (!(server as any)._registerToolWrapped) {
    const original = server.registerTool.bind(server);

    server.registerTool = function (name: string, meta: any, handler: any) {
      // mirror tool
      (server as any).tools[name] = { meta, handler };
      registeredTools[name] = { meta, handler };

      return original(name, meta, handler);
    };

    (server as any)._registerToolWrapped = true;
  }

  // Register LLM
  server.registerTool(
    "llm",
    {
      title: "LLM Assistant",
      description: "Routers · Rules · Intent Hybrid",
      inputSchema: { message: z.string() }
    },
    async ({ message }) => {
      const result = await handleUserMessage(message, server);

      return {
        content: [
          {
            type: "text",
            text: result.text
          }
        ]
      };
    }
  );
}
