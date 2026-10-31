// src/mcp/server/setupLLMTool.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
// we no longer use handleUserMessage here
import { askLLM } from "../llm/llm.js";

import { registerTool } from "../tools/registry.js";

// simple explicit type for the tool input
type LlmToolInput = {
  message: string;
};

// separate schema so we can cast it
const llmInputSchema = {
  message: z.string()
};

export function setupLLMTool(server: McpServer) {
  // Register "llm" tool – used only when MCP clients call it directly,
  // completely separate from the /chat endpoint.
  registerTool(server,
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
