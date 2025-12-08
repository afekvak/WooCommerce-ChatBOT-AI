// src/mcp/server/setupLLMTool.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { handleUserMessage } from "../llm/router.js";

export const registeredTools: any = {};

// keep a simple explicit type for the tool input
type LlmToolInput = {
  message: string;
};

// separate schema so we can cast it
const llmInputSchema = {
  message: z.string()
};

export function setupLLMTool(server: McpServer) {
  // Make sure registry exists
  if (!(server as any).tools) {
    (server as any).tools = {};
  }

  // Wrap only ONE TIME
  if (!(server as any)._registerToolWrapped) {
    const original = server.registerTool.bind(server);

    // note the cast to any here to avoid type issues
    (server as any).registerTool = function (name: string, meta: any, handler: any) {
      // mirror tool
      (server as any).tools[name] = { meta, handler };
      registeredTools[name] = { meta, handler };

      return original(name, meta, handler);
    };

    (server as any)._registerToolWrapped = true;
  }

  // Register LLM
  (server as any).registerTool(
    "llm",
    {
      title: "LLM Assistant",
      description: "Routers · Rules · Intent Hybrid",
      // important cast: stop TS from trying to derive a huge type
      inputSchema: llmInputSchema as any
    },
    // explicit, simple input type for the handler
    async (input: LlmToolInput) => {
      const result = await handleUserMessage(input.message, server);

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
