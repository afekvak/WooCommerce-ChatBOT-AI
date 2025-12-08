// src/mcp/types.ts

export interface MCPContentBlock {
  [key: string]: unknown;          
  type: "text";
  text: string;
  _meta?: Record<string, unknown>;
}

export interface MCPToolResponse {
  [key: string]: unknown;          
  content: MCPContentBlock[];
}

// export interface ToolHandlerArgs {
//   [key: string]: any;
// }

export interface HybridFastRuleResult {
  hit: boolean;
  tool?: string;
  args?: Record<string, any>;
  askUser?: string;
}

export interface IntentDecision {
  shouldUseTool: boolean;
  toolName?: string;
  args: Record<string, any>;
  reason: string;
}
export interface BotReply {
  text: string;
  debug?: string | Record<string, any>;
}


