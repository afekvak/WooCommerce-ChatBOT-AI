// src/mcp/llm/quickRules.ts
import type { HybridFastRuleResult } from "../types";

export function quickRules(message: string): HybridFastRuleResult {
  const trimmed = message.trim();

  // 1. Bare number guard (user just sends "200" etc)
  if (/^\d{2,}$/.test(trimmed)) {
    return {
      hit: true,
      tool: undefined,
      args: {},
      askUser:
        "You sent only a number. Do you mean a product ID, a SKU, a quantity, or a price?\n" +
        'For example: "product 1864", "sku mouse-1", "set price to 200".'
    };
  }

  // 2. Default – no rule matched
  return {
    hit: false
  };
}
