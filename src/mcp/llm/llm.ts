// src/mcp/llm/llm.ts
import OpenAI from "openai";
import { getHistory } from "./history";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL
});

// optional options for the fallback chat LLM
export interface AskLLMOptions {
  clientName?: string;
}

// main fallback chat call
export async function askLLM(
  text: string,
  options: AskLLMOptions = {}
) {
  const { clientName } = options;

  // Stronger but still sane guidance about using the name
  const baseSystem =
    "You are a WooCommerce shop assistant. Follow the project rules strictly. Be concise but friendly.";

  const nameNote = clientName
    ? ` The store owner is named "${clientName}". In greetings or short confirmations it is good practice to address them by name in a natural way, especially in your first reply of a conversation. Do not overuse their name in every sentence.`
    : " You do not know the user's name for this request, so do not invent one.";

  const systemContent = baseSystem + nameNote;

  return openai.chat.completions.create({
    model: process.env.LLM_MODEL || "gpt-3.5-turbo",
    messages: [
      { role: "system", content: systemContent },
      ...getHistory(),
      { role: "user", content: text }
    ]
  });
}

/**
 * Build a short friendly intro line that comes before a tool result.
 * Example output:
 *  "Here is the information I found for this product."
 *  "Here is an overview of products that match what you asked for."
 *
 * NOTE: This helper must NOT mention the user's name, even if provided.
 */
export async function buildToolIntro(params: {
  toolName: string;
  lastUserMessage: string;
  clientName?: string; // accepted but not used in the sentence
}): Promise<string> {
  const { toolName, lastUserMessage } = params;

  const systemPrompt = `
You are a helper that writes a single friendly sentence that introduces a tool result
for a WooCommerce assistant.

You do NOT decide which tool to use and you do NOT show any raw data.
You only write an intro sentence that will appear before the tool output.

Rules:
• Use a warm professional tone.
• Mention the tool context in natural language (for example: product details, a list of products, category results, etc.).
• You MUST NOT mention the user's name even if it is provided in the input.
• Never ask new questions here, this text comes AFTER the user already asked.
• Output only one sentence, no bullet list, no code fences, no markdown.

Examples:

Input:
  toolName: "woo_get_product_by_id"
  lastUserMessage: "show me product 1849"

Possible output:
  "Here is the information I found for that product."

Input:
  toolName: "woo_get_products"
  lastUserMessage: "show me my latest products"

Possible output:
  "Here is an overview of products that match what you asked for."

Input:
  toolName: "woo_get_products_by_category"
  lastUserMessage: "show me all products in category 12"

Possible output:
  "Here are the products I found in the requested category."
`.trim();

  const userPayload = {
    toolName,
    lastUserMessage,
    // clientName is intentionally ignored in the text, but kept in payload for future use if needed
    clientName: params.clientName ?? null
  };

  const completion = await openai.chat.completions.create({
    model: process.env.LLM_MODEL || "gpt-3.5-turbo",
    temperature: 0.4,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: JSON.stringify(userPayload)
      }
    ]
  });

  const text =
    completion.choices?.[0]?.message?.content?.trim() || "";

  if (!text) {
    return "Here is the information I collected for you.";
  }

  // normalize to a single line just in case
  return text.replace(/\s+/g, " ").trim();
}
