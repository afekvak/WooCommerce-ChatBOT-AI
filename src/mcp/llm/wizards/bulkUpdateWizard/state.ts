export type BulkScope = "all" | "category";

export type BulkStage =
  | "scope"            // all products or category
  | "category_detail"  // which category
  | "field"            // which field to update
  | "mode"             // set vs percent
  | "value"            // value or extra info
  | "confirm";         // final confirm

export type BulkOperation =
  | "set"
  | "increase_percent"
  | "decrease_percent";

export interface BulkUpdateWizardState {
  stage: BulkStage;

  // scope
  scope?: BulkScope;
  categoryId?: number;
  // can be slug or human category name such as "electronics"
  categorySlugOrName?: string;

  // target field
  fieldKey?: string;

  // operation
  operation?: BulkOperation;

  // numeric percent for percent operations
  percent?: number;

  // value to set for "set" operations or non numeric fields
  value?: any;

  // optional hint parsed from first message
  // used when we know percent but still need user to choose increase or decrease
  seedPercent?: number;
}

const bulkSessions = new Map<string, BulkUpdateWizardState>();

export function getBulkWizard(
  sessionId: string
): BulkUpdateWizardState | undefined {
  return bulkSessions.get(sessionId);
}

export function setBulkWizard(
  sessionId: string,
  state: BulkUpdateWizardState
): void {
  bulkSessions.set(sessionId, state);
}

export function clearBulkWizard(sessionId: string): void {
  bulkSessions.delete(sessionId);
}
