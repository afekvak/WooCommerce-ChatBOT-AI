import {
  BulkUpdateWizardState,
  BulkOperation,
  BulkScope,
  setBulkWizard,
  getBulkWizard,
  clearBulkWizard
} from "./state";
import { createWooClient } from "../../../../controllers/wooClient";

type StepResult = { reply: string; done: boolean };

// which fields can be bulk updated
// you can extend this list at any time
const BULK_FIELDS = [
  "regular_price",
  "sale_price",
  "status",
  "stock_status",
  "manage_stock",
  "stock_quantity",
  "backorders",
  "catalog_visibility",
  "featured",
  "reviews_allowed",
  "purchase_note",
  "tax_status",
  "tax_class"
];

const NUMERIC_FIELDS = new Set([
  "regular_price",
  "sale_price",
  "stock_quantity"
]);

const PRICE_FIELDS = new Set(["regular_price", "sale_price"]);

// ============================
// PUBLIC API
// ============================

export async function startBulkUpdateWizard(
  sessionId: string,
  seed: {
    percent?: number;
    scope?: BulkScope;
    field?: string;
    operation?: BulkOperation;
    categoryId?: number;
    category?: string;       // slug or name
    categoryHint?: string;   // free text such as "electronics"
    value?: any;
  } = {}
): Promise<StepResult> {
  const state: BulkUpdateWizardState = {
    stage: "scope",
    seedPercent: seed.percent
  };

  // seed basic scope and field
  if (seed.scope) state.scope = seed.scope;
  if (seed.field) state.fieldKey = normalizeFieldKey(seed.field);

  // seed category information from any of the possible keys
  if (typeof seed.categoryId === "number") {
    state.categoryId = seed.categoryId;
  } else if (typeof seed.category === "string") {
    state.categorySlugOrName = seed.category;
  } else if (typeof seed.categoryHint === "string") {
    state.categorySlugOrName = seed.categoryHint;
  }

  // seed operation plus numbers
  if (seed.operation) {
    state.operation = seed.operation;
  }

  if (typeof seed.percent === "number") {
    state.percent = seed.percent;
  }

  if (typeof seed.value !== "undefined") {
    state.value = seed.value;
  }

  // -------------- FAST PATH --------------
  // if the intent analyzer already gave a complete bulk command
  // go straight to confirmation window

  const hasScope = !!state.scope;
  const hasCategory =
    state.scope === "all"
      ? true
      : state.scope === "category"
      ? !!state.categoryId || !!state.categorySlugOrName
      : false;

  const hasField = !!state.fieldKey;

  const op = state.operation;

  const hasPercentOp =
    !!op &&
    (op === "increase_percent" || op === "decrease_percent") &&
    state.fieldKey != null &&
    isNumericField(state.fieldKey) &&
    typeof state.percent === "number" &&
    state.percent > 0;

  const hasSetOp =
    op === "set" &&
    typeof state.value !== "undefined" &&
    state.value !== null &&
    state.value !== "";

  if (hasScope && hasCategory && hasField && (hasPercentOp || hasSetOp)) {
    state.stage = "confirm";
    setBulkWizard(sessionId, state);
    return {
      done: false,
      reply: buildBulkConfirmationSummary(state)
    };
  }

  // -------------- NORMAL FIRST STAGE --------------
  // same logic as before when some information is missing

  if (!state.scope) {
    state.stage = "scope";
  } else if (
    state.scope === "category" &&
    !state.categoryId &&
    !state.categorySlugOrName
  ) {
    state.stage = "category_detail";
  } else if (!state.fieldKey) {
    state.stage = "field";
  } else if (state.fieldKey && isNumericField(state.fieldKey)) {
    state.stage = "mode";
  } else {
    state.stage = "value";
  }

  setBulkWizard(sessionId, state);

  // produce first prompt
  return nextPromptForState(state);
}

export async function handleBulkUpdateWizardStep(
  sessionId: string,
  message: string
): Promise<StepResult> {
  const state = getBulkWizard(sessionId);
  if (!state) {
    return { reply: "Bulk update wizard error: no active session.", done: true };
  }

  const raw = message.trim();
  const t = raw.toLowerCase();

  if (
  t === "cancel" ||
  t === "no" ||
  /^__WIZ_CANCEL__/i.test(raw)
) {
  clearBulkWizard(sessionId);
  return { reply: "Bulk update wizard cancelled.", done: true };
}


  // route by stage
  if (state.stage === "scope") {
    return handleScopeStage(sessionId, state, raw);
  }

  if (state.stage === "category_detail") {
    return handleCategoryDetailStage(sessionId, state, raw);
  }

  if (state.stage === "field") {
    return handleFieldStage(sessionId, state, raw);
  }

  if (state.stage === "mode") {
    return handleModeStage(sessionId, state, raw);
  }

  if (state.stage === "value") {
    return handleValueStage(sessionId, state, raw);
  }

  if (state.stage === "confirm") {
    return handleConfirmStage(sessionId, state, raw);
  }

  clearBulkWizard(sessionId);
  return {
    reply: "Bulk update wizard internal state is invalid. Cancelling.",
    done: true
  };
}

// ============================
// STAGE HELPERS
// ============================

function nextPromptForState(state: BulkUpdateWizardState): StepResult {
  if (state.stage === "scope") {
    return {
      done: false,
      reply: [
        "Bulk product update wizard.",
        "",
        "I can update one field for all products or only products in a specific category.",
        "",
        'Which products do you want to update? Type "all" or "category".'
      ].join("\n")
    };
  }

  if (state.stage === "category_detail") {
    return {
      done: false,
      reply:
        "You chose category scope.\n" +
        "Type the category id or slug or name you want to target. Example: 12 or shirts."
    };
  }

  if (state.stage === "field") {
    return {
      done: false,
      reply:
        "Which field do you want to update for these products?\n" +
        "You can type a field name or a partial name, for example: price, sale, stock, status.\n\n" +
        "Available fields:\n" +
        BULK_FIELDS.join(", ")
    };
  }

  if (state.stage === "mode") {
    const fieldLabel = prettyField(state.fieldKey!);
    const base = [`You selected field: ${fieldLabel}.`, ""];

    if (state.seedPercent != null) {
      base.push(
        `I detected percent ${state.seedPercent}.`,
        "",
        "How do you want to apply it?",
        'Type one of: "increase", "decrease", or "set".',
        "",
        "- increase  → increase each value by that percent",
        "- decrease  → decrease each value by that percent",
        "- set       → set a fixed value (I will ask next)"
      );
    } else {
      base.push(
        "How do you want to update this numeric field?",
        "",
        "You can:",
        "- set VALUE        → set a fixed value, I will ask VALUE next",
        "- increase by X%   → increase values by a percentage",
        "- decrease by X%   → decrease values by a percentage",
        "",
        "Examples:",
        "  increase by 10%",
        "  decrease by 5%",
        "  set"
      );
    }

    return { done: false, reply: base.join("\n") };
  }

  if (state.stage === "value") {
    const fieldLabel = prettyField(state.fieldKey!);

    if (state.operation === "set" && isNumericField(state.fieldKey!)) {
      return {
        done: false,
        reply:
          `What numeric value should I set for ${fieldLabel} on all selected products?\n` +
          "Example: 199.99"
      };
    }

    if (!isNumericField(state.fieldKey!)) {
      return {
        done: false,
        reply:
          `What value should I set for ${fieldLabel} on all selected products?`
      };
    }

    // numeric field but we are here only for "set"
    return {
      done: false,
      reply: `What value should I set for ${fieldLabel}?`
    };
  }

  if (state.stage === "confirm") {
    return {
      done: false,
      reply: buildBulkConfirmationSummary(state)
    };
  }

  return { done: false, reply: "Bulk wizard is waiting for input." };
}

function handleScopeStage(
  sessionId: string,
  state: BulkUpdateWizardState,
  answer: string
): StepResult {
  const t = answer.toLowerCase().trim();

  if (t === "all" || t === "everything") {
    state.scope = "all";
    state.stage = state.fieldKey
      ? isNumericField(state.fieldKey)
        ? "mode"
        : "value"
      : "field";
    setBulkWizard(sessionId, state);
    return nextPromptForState(state);
  }

  if (t === "category" || t === "cat") {
    state.scope = "category";
    state.stage = "category_detail";
    setBulkWizard(sessionId, state);
    return nextPromptForState(state);
  }

  return {
    done: false,
    reply: 'Please type "all" for all products or "category" to target a category.'
  };
}

function handleCategoryDetailStage(
  sessionId: string,
  state: BulkUpdateWizardState,
  answer: string
): StepResult {
  const raw = answer.trim();
  if (!raw) {
    return {
      done: false,
      reply: "Please type a category id or slug or name."
    };
  }

  const idMatch = raw.match(/^\d+$/);
  if (idMatch) {
    state.categoryId = parseInt(idMatch[0], 10);
  } else {
    state.categorySlugOrName = raw;
  }

  state.stage = state.fieldKey
    ? isNumericField(state.fieldKey)
      ? "mode"
      : "value"
    : "field";
  setBulkWizard(sessionId, state);

  return {
    done: false,
    reply:
      "Category saved.\n\n" +
      "Now choose which field you want to update for products in this category."
  };
}

function handleFieldStage(
  sessionId: string,
  state: BulkUpdateWizardState,
  answer: string
): StepResult {
  const raw = answer.trim().toLowerCase();
  if (!raw) {
    return nextPromptForState(state);
  }

  const chosen = chooseField(raw);
  if (!chosen) {
    return {
      done: false,
      reply:
        "I could not match that to any bulk updatable field.\n" +
        "Available fields: " +
        BULK_FIELDS.join(", ")
    };
  }

  state.fieldKey = chosen;

  if (isNumericField(chosen)) {
    state.stage = "mode";
  } else {
    state.stage = "value";
  }

  setBulkWizard(sessionId, state);
  return nextPromptForState(state);
}

function handleModeStage(
  sessionId: string,
  state: BulkUpdateWizardState,
  answer: string
): StepResult {
  const raw = answer.trim();
  const t = raw.toLowerCase();

  // case when seedPercent exists and we just need increase or decrease or set
  if (state.seedPercent != null && state.percent == null) {
    if (t === "increase" || t === "up" || t === "more") {
      state.operation = "increase_percent";
      state.percent = state.seedPercent;
      state.stage = "confirm";
      setBulkWizard(sessionId, state);
      return nextPromptForState(state);
    }

    if (t === "decrease" || t === "down" || t === "less") {
      state.operation = "decrease_percent";
      state.percent = state.seedPercent;
      state.stage = "confirm";
      setBulkWizard(sessionId, state);
      return nextPromptForState(state);
    }

    if (t === "set" || t === "fixed") {
      state.operation = "set";
      state.stage = "value";
      setBulkWizard(sessionId, state);
      return nextPromptForState(state);
    }

    return {
      done: false,
      reply:
        "Please answer increase, decrease, or set.\n" +
        "increase  → increase by the detected percent\n" +
        "decrease  → decrease by the detected percent\n" +
        "set       → set a fixed value"
    };
  }

  // no seed, try to parse percent from the same sentence
  if (t.startsWith("set")) {
    state.operation = "set";
    state.stage = "value";
    setBulkWizard(sessionId, state);
    return nextPromptForState(state);
  }

  const percentMatch = t.match(/(\d+(?:\.\d+)?)\s*%?/);
  if (!percentMatch) {
    return {
      done: false,
      reply:
        "I could not detect a percent.\n" +
        "Please say something like:\n" +
        "  increase by 10%\n" +
        "  decrease by 5%\n" +
        "or type set if you want to set a fixed value."
    };
  }

  const p = parseFloat(percentMatch[1]);
  if (!Number.isFinite(p) || p <= 0) {
    return { done: false, reply: "Percent must be a positive number." };
  }

  let op: BulkOperation = "increase_percent";
  if (
    t.includes("decrease") ||
    t.includes("down") ||
    t.includes("reduce") ||
    t.includes("less")
  ) {
    op = "decrease_percent";
  }

  state.operation = op;
  state.percent = p;
  state.stage = "confirm";
  setBulkWizard(sessionId, state);

  return nextPromptForState(state);
}

function handleValueStage(
  sessionId: string,
  state: BulkUpdateWizardState,
  answer: string
): StepResult {
  const raw = answer.trim();
  if (!raw) {
    return {
      done: false,
      reply: "Please type a value."
    };
  }

  const field = state.fieldKey!;
  if (isNumericField(field) && state.operation === "set") {
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      return {
        done: false,
        reply: "Please type a valid number value."
      };
    }

    // keep numeric, actual conversion to string for price happens in executor
    state.value = n;
  } else {
    state.value = raw;
  }

  state.stage = "confirm";
  setBulkWizard(sessionId, state);

  return nextPromptForState(state);
}

// ============================
// CONFIRM STAGE
// ============================

async function handleConfirmStage(
  sessionId: string,
  state: BulkUpdateWizardState,
  answer: string
): Promise<StepResult> {
  const t = answer.trim().toLowerCase();

  if (t === "cancel" || t === "no") {
    clearBulkWizard(sessionId);
    return { reply: "Bulk update wizard cancelled.", done: true };
  }

  if (t !== "confirm" && t !== "yes") {
    return {
      done: false,
      reply:
        'Please click confirm to apply this bulk update or type cancel.\n' +
        "If you left this page and came back type confirm or cancel."
    };
  }

  // execute bulk update
  try {
    const { updated, total } = await executeBulkUpdate(state);
    clearBulkWizard(sessionId);

    const scopeLabel =
      state.scope === "category"
        ? `products in the selected category (${total} found)`
        : `all products (${total} found)`;

    const fieldLabel = prettyField(state.fieldKey!);
    const opLabel = describeOperation(state);

    const replyLines: string[] = [];
    replyLines.push("Bulk product update completed.");
    replyLines.push("");
    replyLines.push(`Scope: ${scopeLabel}`);
    replyLines.push(`Field: ${fieldLabel}`);
    replyLines.push(`Operation: ${opLabel}`);
    replyLines.push(`Updated products: ${updated}/${total}`);

    return {
      reply: replyLines.join("\n"),
      done: true
    };
  } catch (err: any) {
    clearBulkWizard(sessionId);
    return {
      reply: `Bulk update failed: ${err.message}`,
      done: true
    };
  }
}

// ============================
// CONFIRM SUMMARY WITH META
// ============================

function buildBulkConfirmationSummary(state: BulkUpdateWizardState): string {
  const scopeLabel =
    state.scope === "category"
      ? state.categoryId
        ? `Category id ${state.categoryId}`
        : `Category "${state.categorySlugOrName ?? "unknown"}"`
      : "All products";

  const fieldLabel = prettyField(state.fieldKey || "(missing)");
  const opLabel = describeOperation(state);

  const lines: string[] = [];

  lines.push("Here is your bulk update plan.");
  lines.push("");
  lines.push(`Scope: ${scopeLabel}`);
  lines.push(`Field: ${fieldLabel}`);
  lines.push(`Operation: ${opLabel}`);
  lines.push("");
  lines.push("Type confirm to apply this update, or cancel to abort.");

  const meta = {
    type: "wizard_confirm",
    wizard: "bulk_update",
    action: "bulk_update",
    productName: "Bulk product update",
    description: lines.join("\n"),
    summary: {
      scope: scopeLabel,
      field: fieldLabel,
      operation: opLabel,
      percent: state.percent ?? null,
      value: state.value ?? null
    }
  };

  lines.push("");
  lines.push("[[WIZARD_CONFIRM_META]]");
  lines.push(JSON.stringify(meta));
  lines.push("[[END_WIZARD_CONFIRM_META]]");

  return lines.join("\n");
}

// ============================
// EXECUTION
// ============================

async function executeBulkUpdate(
  state: BulkUpdateWizardState
): Promise<{ total: number; updated: number }> {
  const url = process.env.WOO_URL!;
  const ck = process.env.WOO_CK!;
  const cs = process.env.WOO_CS!;

  const api = createWooClient(url, ck, cs);

  let categoryId: number | undefined = state.categoryId;

  if (state.scope === "category" && !categoryId && state.categorySlugOrName) {
    // resolve slug or name to id
    const resp = await api.get("products/categories", {
      per_page: 10,
      search: state.categorySlugOrName
    });

    const cat = Array.isArray(resp.data) ? resp.data[0] : undefined;
    if (!cat || !cat.id) {
      throw new Error(
        `Could not resolve category "${state.categorySlugOrName}" to an id.`
      );
    }
    categoryId = cat.id;
  }

  const field = state.fieldKey!;
  const op = state.operation!;
  const percent = state.percent ?? 0;
  const setValue = state.value;

  let page = 1;
  const perPage = 50;
  let total = 0;
  let updated = 0;

  // simple pagination loop
  // stop when we get less than perPage
  // Woo client returns axios style { data }
  while (true) {
    const params: any = {
      per_page: perPage,
      page
    };

    if (state.scope === "category" && categoryId) {
      params.category = categoryId;
    }

    const res = await api.get("products", params);
    const products: any[] = Array.isArray(res.data) ? res.data : [];

    if (!products.length) {
      break;
    }

    total += products.length;

    const updates: any[] = [];

    for (const p of products) {
      const productId = p.id;

      const updateFragment = buildUpdateFragmentForProduct(
        p,
        field,
        op,
        percent,
        setValue
      );

      if (updateFragment) {
        updates.push({ id: productId, ...updateFragment });
      }
    }

    if (updates.length) {
      await api.put("products/batch", { update: updates });
      updated += updates.length;
    }

    if (products.length < perPage) {
      break;
    }
    page += 1;
  }

  return { total, updated };
}

function buildUpdateFragmentForProduct(
  product: any,
  field: string,
  op: BulkOperation,
  percent: number,
  setValue: any
): any | null {
  // non numeric "set"
  if (!isNumericField(field) || op === "set") {
    if (setValue === undefined || setValue === null || setValue === "") {
      return null;
    }

    // for price fields convert to string
    if (PRICE_FIELDS.has(field)) {
      const n =
        typeof setValue === "number" ? setValue : Number(String(setValue));
      if (!Number.isFinite(n)) return null;
      return { [field]: n.toFixed(2) };
    }

    return { [field]: setValue };
  }

  // numeric percent operations
  const rawCurrent = product[field];
  const current = Number(rawCurrent);
  if (!Number.isFinite(current)) {
    return null;
  }

  let newVal = current;

  if (op === "increase_percent") {
    newVal = current * (1 + percent / 100);
  } else if (op === "decrease_percent") {
    newVal = current * (1 - percent / 100);
  }

  if (field === "stock_quantity") {
    const intVal = Math.round(newVal);
    if (intVal < 0) return null;
    return { stock_quantity: intVal };
  }

  if (PRICE_FIELDS.has(field)) {
    const price = newVal < 0 ? 0 : newVal;
    return { [field]: price.toFixed(2) };
  }

  // fallback numeric
  return { [field]: newVal };
}

// ============================
// SMALL HELPERS
// ============================

function isNumericField(field: string): boolean {
  return NUMERIC_FIELDS.has(field as any);
}

function normalizeFieldKey(field: string): string | undefined {
  const lower = field.toLowerCase().trim();

  // special friendly aliases
  if (lower === "price" || lower === "regular price") return "regular_price";
  if (lower === "sale" || lower === "sale price") return "sale_price";

  const direct = BULK_FIELDS.find((f) => f === lower);
  if (direct) return direct;

  const partial = BULK_FIELDS.find((f) => f.includes(lower));
  return partial;
}

function chooseField(input: string): string | undefined {
  const lower = input.toLowerCase();

  const alias = normalizeFieldKey(lower);
  if (alias) return alias;

  return undefined;
}

function prettyField(field: string): string {
  return field.replace(/_/g, " ");
}

function describeOperation(state: BulkUpdateWizardState): string {
  const op = state.operation;
  if (!op) return "(none)";

  if (op === "set") {
    return `Set to ${state.value}`;
  }

  if (op === "increase_percent") {
    return `Increase by ${state.percent}%`;
  }

  if (op === "decrease_percent") {
    return `Decrease by ${state.percent}%`;
  }

  return "(unknown)";
}
