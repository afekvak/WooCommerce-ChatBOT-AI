// llm.ts
import OpenAI from "openai";
import { getHistory } from "./history";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL
});

export async function askLLM(text: string) {
  return openai.chat.completions.create({
    model: process.env.LLM_MODEL || "gpt-3.5-turbo",
    messages: [
      { role: "system", content: "Follow rules strictly. Be concise." },
      ...getHistory(),
      { role: "user", content: text }
    ]
  });
}
