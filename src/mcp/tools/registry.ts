// src/mcp/tools/registry.ts
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import type { MCPToolResponse, ToolCtx } from "../types";

interface ToolMetadata {
  title?: string;
  description: string;
  inputSchema: z.AnyZodObject | z.ZodRawShape;
  chat?: { terminal?: boolean; display?: "card" | "hidden" };
}

export interface RegisteredTool {
  name: string;
  title?: string;
  description: string;
  inputSchema: z.AnyZodObject;
  chat?: { terminal?: boolean; display?: "card" | "hidden" };
  mcp: boolean;
  handler: (args: any, ctx?: ToolCtx) => Promise<MCPToolResponse>;
}

// Definitions belong to a server, rather than leaking across server instances.
const registries = new WeakMap<McpServer, Map<string, RegisteredTool>>();

function registryFor(server: McpServer) {
  let registry = registries.get(server);
  if (!registry) {
    registry = new Map();
    registries.set(server, registry);
  }
  return registry;
}

export function getTool(server: McpServer, name: string) {
  return registryFor(server).get(name);
}

export function listTools(server: McpServer): RegisteredTool[] {
  return [...registryFor(server).values()];
}

export async function executeTool(
  server: McpServer, name: string, args: unknown, ctx?: ToolCtx
): Promise<MCPToolResponse> {
  const tool = getTool(server, name);
  if (!tool) {
    return { isError: true, content: [{ type: "text", text: `Unknown tool: ${name}` }] };
  }
  const parsed = tool.inputSchema.safeParse(args);
  if (!parsed.success) {
    // Do not echo potentially sensitive argument values in validation errors.
    const fields = parsed.error.issues.map(issue => issue.path.join(".") || "input");
    return {
      isError: true,
      content: [{ type: "text", text: `Invalid arguments for ${name}: ${[...new Set(fields)].join(", ")}` }]
    };
  }
  return tool.handler(parsed.data, ctx);
}

/** Define once for both MCP discovery and validated chat execution. */
export function registerTool(
  server: McpServer, name: string, metadata: ToolMetadata,
  handler: RegisteredTool["handler"]
) {
  const registry = registryFor(server);
  if (registry.has(name)) throw new Error(`Tool already registered: ${name}`);
  const inputSchema = metadata.inputSchema instanceof z.ZodObject
    ? metadata.inputSchema
    : z.object(metadata.inputSchema);

  const { chat, ...mcpMetadata } = metadata;
  server.registerTool(name, { ...mcpMetadata, inputSchema: inputSchema.shape },
    // MCP transport metadata is not authenticated application client context.
    async (args: unknown) => executeTool(server, name, args));
  registry.set(name, { name, ...metadata, inputSchema, handler, mcp: true });
}

/** Conversation workflows need a server-owned session and are not standalone MCP tools. */
export function registerChatTool(
  server: McpServer, name: string, metadata: ToolMetadata,
  handler: RegisteredTool["handler"]
) {
  const registry = registryFor(server);
  if (registry.has(name)) throw new Error(`Tool already registered: ${name}`);
  const inputSchema = metadata.inputSchema instanceof z.ZodObject
    ? metadata.inputSchema : z.object(metadata.inputSchema);
  registry.set(name, { name, ...metadata, inputSchema, handler, mcp: false });
}
