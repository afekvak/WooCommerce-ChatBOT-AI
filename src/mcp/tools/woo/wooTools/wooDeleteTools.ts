import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import type { MCPToolResponse } from "../../../types";
import { registeredTools } from "../../registry";

import {
  
} from "../args/deleteArgs";

import {
  
} from "../wooSchemas/deleteSchemas";

import {
  
} from "../../../../controllers/wooDeleteController";

import {
  
} from "../../../../utils/formatWoo";

export function registerWooDeleteTools(server: McpServer) {
  // no add tools yet
}
