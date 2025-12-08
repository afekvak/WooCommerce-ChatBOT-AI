import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import type { TextContent } from "@modelcontextprotocol/sdk/types.js";
import { registeredTools } from "../registry";

export function registerDateTool(server: McpServer) {
  const handler = async (_args: any, _extra: any) => {
    const now = new Date();

    const block: TextContent = {
      type: "text",
      text: `Today's date is ${now.toDateString()} (${now.toLocaleTimeString()})`,
    };

    return {
      content: [block],
    };
  };

  server.registerTool(
    "get_date",
    {
      title: "Get Current Date",
      description: "Returns today's date and time",
      inputSchema: {},
    },
    handler
  );

  registeredTools["get_date"] = { handler };
}
