// history.ts
import type { ChatCompletionMessageParam } from "openai/resources/chat";

const MAX_HISTORY = 10;
let history: ChatCompletionMessageParam[] = [];

export function addUserMessage(text: string) {
  history.push({ role: "user", content: text });
  trim();
}

export function addAssistantMessage(text: string) {
  history.push({ role: "assistant", content: text });
  trim();
}

export function getHistory(): ChatCompletionMessageParam[] {
  return history;
}

function trim() {
  if (history.length > MAX_HISTORY) {
    history = history.slice(-MAX_HISTORY);
  }
}
