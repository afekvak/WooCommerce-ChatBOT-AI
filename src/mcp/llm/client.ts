import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config({ quiet: true });
let client: OpenAI | undefined;

export function getLlmClient() {
  return client ??= new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL
  });
}

export function getLlmModel() {
  return process.env.LLM_MODEL?.trim() || "gpt-5.6-terra";
}

// Terra requires reasoning disabled when using tools through Chat Completions.
export function getLlmChatOptions() {
  return getLlmModel() === "gpt-5.6-terra" ? { reasoning_effort: "none" as const } : {};
}
