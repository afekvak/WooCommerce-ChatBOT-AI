// src/mcp/llm/wizard/state.ts

export type WizardMode = "create_product";

export type WizardStage =
  | "mode_choice"    // ask user: wizard or json
  | "json"           // user pastes raw JSON payload
  | "basic"          // asking basic fields
  | "ask_advanced"   // asking user if they want advanced options
  | "advanced"       // going through advanced sections
  | "confirm";       // showing summary and asking confirm

export type WizardAdvancedMode =
  | "none"
  | "full"
  | "sections";

export interface WizardState {
  mode: WizardMode;
  stage: WizardStage;

  // basic flow
  basicIndex: number;

  // advanced flow configuration
  advancedMode: WizardAdvancedMode;
  advancedSections: string[];      // example: ["pricing", "shipping", "stock"]
  currentSectionIndex: number;     // index in advancedSections
  currentFieldIndex: number;       // index inside current section questions

  // collected data that will be sent to WooCommerce
  data: Record<string, any>;
}

const wizardStore: Record<string, WizardState> = {};

// get current session
export function getWizard(sessionId: string): WizardState | undefined {
  return wizardStore[sessionId];
}

// create or update wizard
export function setWizard(sessionId: string, state: WizardState): void {
  wizardStore[sessionId] = state;
}

// delete wizard session
export function clearWizard(sessionId: string): void {
  delete wizardStore[sessionId];
}
