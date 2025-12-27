// src/mcp/llm/history.ts
import type { ChatCompletionMessageParam } from "openai/resources/chat";

const MAX_HISTORY = 10;

// sessionKey => messages
const histories = new Map<string, ChatCompletionMessageParam[]>();

function getOrInit(sessionKey: string) {
  const key = sessionKey && sessionKey.trim() ? sessionKey.trim() : "default";
  let h = histories.get(key);
  if (!h) {
    h = [];
    histories.set(key, h);
  }
  return h;
}

function trim(sessionKey: string) {
  const h = getOrInit(sessionKey);
  if (h.length > MAX_HISTORY) {
    const sliced = h.slice(-MAX_HISTORY);
    histories.set(sessionKey, sliced);
  }
}

export function addUserMessage(sessionKey: string, text: string) {
  const h = getOrInit(sessionKey);
  h.push({ role: "user", content: text });
  trim(sessionKey);
}

export function addAssistantMessage(sessionKey: string, text: string) {
  const h = getOrInit(sessionKey);
  h.push({ role: "assistant", content: text });
  trim(sessionKey);
}

export function getHistory(sessionKey: string): ChatCompletionMessageParam[] {
  return [...getOrInit(sessionKey)];
}

export function clearHistory(sessionKey: string) {
  histories.delete(sessionKey);
}
