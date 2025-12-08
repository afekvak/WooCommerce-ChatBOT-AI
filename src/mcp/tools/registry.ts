// src/mcp/tools/registry.ts
import type { MCPToolResponse } from "../types";

export interface RegisteredTool {
  meta?: any;
  handler: (args: any, extra?: any) => Promise<MCPToolResponse>;
}

export const registeredTools: Record<string, RegisteredTool> = {};
