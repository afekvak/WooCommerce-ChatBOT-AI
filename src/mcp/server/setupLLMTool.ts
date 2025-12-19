// src/mcp/server/setupLLMTool.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
// we no longer use handleUserMessage here
import { askLLM } from "../llm/llm.js";

export const registeredTools: any = {};

// simple explicit type for the tool input
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

  // Wrap only ONE TIME so we mirror tools into server.tools + registeredTools
  if (!(server as any)._registerToolWrapped) {
    const original = server.registerTool.bind(server);

    (server as any).registerTool = function (
      name: string,
      meta: any,
      handler: any
    ) {
      // mirror tool
      (server as any).tools[name] = { meta, handler };
      registeredTools[name] = { meta, handler };

      return original(name, meta, handler);
    };

    (server as any)._registerToolWrapped = true;
  }

  // Register "llm" tool – used only when MCP clients call it directly,
  // completely separate from the /chat endpoint.
  (server as any).registerTool(
    "llm",
    {
      title: "LLM Assistant",
      description: "Plain LLM chat without WooCommerce tools",
      // important cast: keep the schema simple so TS does not explode
      inputSchema: llmInputSchema as any
    },
    // explicit, simple input type for the handler
    async (input: LlmToolInput) => {
      const completion = await askLLM(input.message);
      const text =
        completion.choices?.[0]?.message?.content || "(no content from LLM)";

      return {
        content: [
          {
            type: "text",
            text
          }
        ]
      };
    }
  );
}
