// src/mcp/types.ts
import type { ClientConfig } from "../clientConfig/types.js"; 
import type { ConversationMemory } from "../services/chatMemory";

export interface ClientContext {
  id: string;
  clientKey: string;
  name?: string | null;
  wooUrl?: string | null;
  wooCk?: string | null;
  wooCs?: string | null;
  // add more client fields if needed
}

export interface ToolCtx {
  sessionKey?: string;
  memory?: ConversationMemory;
  client?: ClientContext;
  clientConfig?: ClientConfig; 
}


export interface MCPContentBlock {
  [key: string]: unknown;          
  type: "text";
  text: string;
  _meta?: Record<string, unknown>;
}

export interface MCPToolResponse {
  /** Server-rendered output for the widget; separate from structured tool data sent to the model. */
  presentation?: { html: string };
  [key: string]: unknown;          
  content: MCPContentBlock[];
}

// export interface ToolHandlerArgs {
//   [key: string]: any;
// }

export interface BotReply {
  text: string;
  debug?: string | Record<string, any>;
}


