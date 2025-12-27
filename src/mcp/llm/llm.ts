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
  sessionKey?: string;
}

// main fallback chat call
export async function askLLM(
  text: string,
  options: AskLLMOptions = {}
) {
  const { clientName } = options;
  const sessionKey = options.sessionKey || "default";

  // IMPORTANT:
  // This widget is running inside WordPress Admin, so the user is an ADMIN/OWNER, not a shopper.
  // This prevents the model from acting like customer support for storefront visitors.
  const baseSystem =
    "You are an internal WooCommerce Admin Copilot embedded in the WordPress admin dashboard. " +
    "The user chatting with you is the store administrator or store owner, not a shopper/customer. " +
    "Never describe the user as a 'customer', 'buyer', 'shopper', or 'visitor'. " +
    "If the user asks 'who am I' or asks for identity, explain you only know they are the store admin unless a verified admin name is provided. " +
    "Follow project rules strictly. Be concise, accurate, and helpful.";

  const nameNote = clientName
    ? ` The verified store admin/owner name for this client is "${clientName}". You may address them by name naturally in the first reply of a conversation, but do not overuse the name.`
    : " No verified admin/owner name is available for this client. Do not invent a name.";

  const systemContent = baseSystem + nameNote;

  // Important:
  // The router already stored the current user message into history for this session.
  // So we only send system + session history.
  return openai.chat.completions.create({
    model: process.env.LLM_MODEL || "gpt-3.5-turbo",
    temperature: 0.4,
    messages: [
      { role: "system", content: systemContent },
      ...getHistory(sessionKey)
    ]
  });
}

/**
 * Build a short friendly intro line that comes before a tool result.
 * NOTE: This helper must NOT mention the user's name, even if provided.
 */
export async function buildToolIntro(params: {
  toolName: string;
  lastUserMessage: string;
  clientName?: string;
}): Promise<string> {
  const { toolName, lastUserMessage } = params;

  const systemPrompt =
    "You are a helper that writes a single friendly sentence that introduces a tool result " +
    "for a WooCommerce Admin Copilot (WordPress admin dashboard).\n\n" +
    "You do NOT decide which tool to use and you do NOT show any raw data.\n" +
    "You only write an intro sentence that will appear before the tool output.\n\n" +
    "Rules:\n" +
    "• Use a warm professional tone.\n" +
    "• Mention the tool context in natural language (product details, list of products, category results, etc.).\n" +
    "• You MUST NOT mention the user's name even if it is provided in the input.\n" +
    "• Never ask new questions here; this text comes AFTER the user already asked.\n" +
    "• Output only one sentence, no bullet list, no code fences, no markdown.";

  const userPayload = {
    toolName,
    lastUserMessage,
    clientName: params.clientName ?? null
  };

  const completion = await openai.chat.completions.create({
    model: process.env.LLM_MODEL || "gpt-3.5-turbo",
    temperature: 0.4,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: JSON.stringify(userPayload) }
    ]
  });

  const out =
    completion.choices?.[0]?.message?.content?.trim() || "";

  if (!out) {
    return "Here is the information I collected for you.";
  }

  return out.replace(/\s+/g, " ").trim();
}
