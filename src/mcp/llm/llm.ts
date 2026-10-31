// src/mcp/llm/llm.ts
import { getLlmClient, getLlmModel, getLlmChatOptions } from "./client";
import type { ChatCompletionMessageParam } from "openai/resources/chat";

// optional options for the fallback chat LLM
export interface AskLLMOptions {
  clientName?: string;
  history?: ChatCompletionMessageParam[];
}

// main fallback chat call
export async function askLLM(
  text: string,
  options: AskLLMOptions = {}
) {
  const { clientName } = options;
  const history = options.history || [{ role: "user" as const, content: text }];

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
  return getLlmClient().chat.completions.create({
    model: getLlmModel(),
    ...getLlmChatOptions(),
    messages: [
      { role: "system", content: systemContent },
      ...history
    ]
  });
}
