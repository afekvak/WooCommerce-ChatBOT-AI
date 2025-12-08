// src/mcp/llm/updateproductwizard/state.ts

export type UpdateWizardStage = "choose_fields" | "ask_values" | "confirm";

export interface UpdateProductWizardState {
  stage: UpdateWizardStage;                  // current wizard stage
  productId: number;                         // WooCommerce product ID
  originalProduct: any;                      // full product object from Woo
  fieldKeys: string[];                       // fields to update (name, regular_price, ...)
  fieldIndex: number;                        // index of current field in fieldKeys
  payload: Record<string, any>;             // partial product payload to send in update
}

const updateSessions = new Map<string, UpdateProductWizardState>();

export function getUpdateWizard(
  sessionId: string
): UpdateProductWizardState | undefined {
  return updateSessions.get(sessionId);
}

export function setUpdateWizard(
  sessionId: string,
  state: UpdateProductWizardState
): void {
  updateSessions.set(sessionId, state);
}

export function clearUpdateWizard(sessionId: string): void {
  updateSessions.delete(sessionId);
}
