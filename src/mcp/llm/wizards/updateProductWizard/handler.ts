// src/mcp/llm/updateproductwizard/handler.ts

import { getUpdateWizard, setUpdateWizard, clearUpdateWizard, UpdateProductWizardState } from "./state";
import { getProductById,getProductBySku } from "../../../../controllers/wooGetController";
import { updateProduct } from "../../../../controllers/wooUpdateController";
import { formatSingleProduct } from "../../../../utils/formatWoo";

type StepResult = { reply: string; done: boolean };

// fields we allow the wizard to edit
const ALLOWED_UPDATE_FIELDS = [
  "name",
  "regular_price",
  "sale_price",
  "status",
  "sku",
  "stock_quantity",
  "stock_status",
  "manage_stock",
  "description",
  "short_description"
];

// ================================
// PUBLIC API
// ================================

// ================================
// PUBLIC API
// ================================

export async function startUpdateProductWizard(
  sessionId: string,
  target: { id?: number; sku?: string }
): Promise<StepResult> {
  const url = process.env.WOO_URL!;
  const ck = process.env.WOO_CK!;
  const cs = process.env.WOO_CS!;

  let productId: number | undefined = target.id;
  let original: any | null = null;

  // helper to normalize result from getProductBySku / getProductById
  const firstOrSelf = (result: any): any | null => {
    if (!result) return null;
    if (Array.isArray(result)) return result[0] ?? null;
    return result;
  };

  if (productId != null) {
    // update by numeric ID
    const byId = await getProductById(url, ck, cs, productId);
    original = firstOrSelf(byId);
    productId = original?.id ?? productId;
  } else if (target.sku) {
    let sku = target.sku.trim();

    // 1) try SKU exactly as user typed
    let bySku = await getProductBySku(url, ck, cs, sku);
    original = firstOrSelf(bySku);

    // 2) if not found and there are spaces, also try a "slug" version with dashes
    if (!original && /\s+/.test(sku)) {
      const dashed = sku.replace(/\s+/g, "-");
      if (dashed !== sku) {
        const alt = await getProductBySku(url, ck, cs, dashed);
        const altNorm = firstOrSelf(alt);
        if (altNorm) {
          original = altNorm;
          sku = dashed;
        }
      }
    }

    if (original) {
      productId = original.id ?? original.ID;
    }
  } else {
    return {
      done: true,
      reply: "Update wizard error: missing product id or sku."
    };
  }

  if (!original || !productId) {
    return {
      done: true,
      reply:
        "I could not find this product in WooCommerce. Please check the product id or sku and try again."
    };
  }

  const state: UpdateProductWizardState = {
    stage: "choose_fields",
    productId,
    originalProduct: original,
    fieldKeys: [],
    fieldIndex: 0,
    payload: {}
  };

  setUpdateWizard(sessionId, state);

  const name = original.name ?? "(no name)";

  return {
    done: false,
    reply: [
      `You want to update product #${productId}: ${name}.`,
      "",
      "Which fields do you want to update?",
      "You can type a comma separated list, for example:",
      "  name, regular_price, sale_price, stock_quantity, status, sku",
      "",
      "Or type all to go through a common set of fields.",
      "",
      'You can type "cancel" at any time to abort.'
    ].join("\n")
  };
}


export async function handleUpdateProductWizardStep(
  sessionId: string,
  message: string
): Promise<StepResult> {
  const state = getUpdateWizard(sessionId);
  if (!state) {
    return { reply: "Update wizard error: no active session.", done: true };
  }

  const text = message.trim();
  const lower = text.toLowerCase();

  if (lower === "cancel") {
    clearUpdateWizard(sessionId);
    return { reply: "Product update wizard cancelled.", done: true };
  }

  if (state.stage === "choose_fields") {
    return handleChooseFieldsStage(sessionId, state, text);
  }

  if (state.stage === "ask_values") {
    return handleAskValuesStage(sessionId, state, text);
  }

  if (state.stage === "confirm") {
    return handleConfirmStage(sessionId, state, text);
  }

  clearUpdateWizard(sessionId);
  return {
    reply: "Internal update wizard state is invalid, cancelling wizard.",
    done: true
  };
}

// ================================
// STAGE 1: choose fields
// ================================

function handleChooseFieldsStage(
  sessionId: string,
  state: UpdateProductWizardState,
  answer: string
): StepResult {
  const t = answer.toLowerCase().trim();

  if (t === "all") {
    state.fieldKeys = [...ALLOWED_UPDATE_FIELDS];
  } else {
    const tokens = t
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    const chosen: string[] = [];

    for (const token of tokens) {
      const match = ALLOWED_UPDATE_FIELDS.find(
        (f) => f === token || f.includes(token)
      );
      if (match && !chosen.includes(match)) {
        chosen.push(match);
      }
    }

    if (!chosen.length) {
      return {
        done: false,
        reply:
          "I could not detect any valid field names.\n" +
          "Allowed fields: " +
          ALLOWED_UPDATE_FIELDS.join(", ") +
          "\nExample: name, regular_price, stock_quantity"
      };
    }

    state.fieldKeys = chosen;
  }

  state.fieldIndex = 0;
  state.payload = {};
  state.stage = "ask_values";
  setUpdateWizard(sessionId, state);

  return askNextField(state);
}

// ================================
// STAGE 2: ask values for each field
// ================================

function askNextField(state: UpdateProductWizardState): StepResult {
  const { fieldKeys, fieldIndex, originalProduct } = state;

  if (fieldIndex >= fieldKeys.length) {
    state.stage = "confirm";
    return {
      done: false,
      reply: buildConfirmationSummary(state)
    };
  }

  const field = fieldKeys[fieldIndex];
  const pretty = field.replace(/_/g, " ");
  const current = originalProduct ? originalProduct[field] : undefined;

  return {
    done: false,
    reply:
      `Field: ${pretty}\n` +
      `Current value: ${current ?? "(none)"}\n` +
      "Type a new value to update, or type skip to leave unchanged."
  };
}

function handleAskValuesStage(
  sessionId: string,
  state: UpdateProductWizardState,
  answer: string
): StepResult {
  const t = answer.trim();
  const { fieldKeys } = state;

  let idx = state.fieldIndex;

  if (idx >= fieldKeys.length) {
    state.stage = "confirm";
    setUpdateWizard(sessionId, state);
    return {
      done: false,
      reply: buildConfirmationSummary(state)
    };
  }

  const field = fieldKeys[idx];

  if (t.toLowerCase() !== "skip" && t !== "") {
    let value: any = t;

    if (field === "regular_price" || field === "sale_price") {
      const n = Number(t);
      if (Number.isNaN(n) || n < 0) {
        return {
          done: false,
          reply: "Please type a valid positive number or skip."
        };
      }
      value = n.toFixed(2);
    } else if (field === "stock_quantity") {
      const n = Number(t);
      if (!Number.isInteger(n) || n < 0) {
        return {
          done: false,
          reply: "Please type a valid non negative integer or skip."
        };
      }
      value = n;
    } else if (field === "manage_stock") {
      const low = t.toLowerCase();
      if (["yes", "y", "true"].includes(low)) value = true;
      else if (["no", "n", "false"].includes(low)) value = false;
      else {
        return {
          done: false,
          reply: "Please type yes, no, or skip."
        };
      }
    } else {
      value = t;
    }

    state.payload[field] = value;
  }

  state.fieldIndex = idx + 1;
  setUpdateWizard(sessionId, state);

  return askNextField(state);
}

// ================================
// STAGE 3: confirm and execute
// ================================

function buildConfirmationSummary(state: UpdateProductWizardState): string {
  const { productId, originalProduct, payload } = state;

  const lines: string[] = [];
  const productName = originalProduct?.name ?? "(no name)";

  // This is the text we also want inside the modal
  const description = `The assistant wants to update product #${productId}: ${productName}.`;

  lines.push(description);
  lines.push("");

  const changes: { field: string; before: any; after: any }[] = [];
  const summary: Record<string, string> = {};

  if (Object.keys(payload).length === 0) {
    lines.push("No fields were selected for update.");
  } else {
    lines.push("Planned changes:");
    for (const key of Object.keys(payload)) {
      const pretty = key.replace(/_/g, " ");
      const before = originalProduct ? originalProduct[key] : undefined;
      const after = payload[key];

      changes.push({ field: key, before, after });

      const beforeStr =
        before === undefined || before === null || before === ""
          ? "(none)"
          : String(before);
      const afterStr =
        after === undefined || after === null || after === ""
          ? "(none)"
          : String(after);

      summary[pretty] = `${beforeStr} → ${afterStr}`;
      lines.push(`• ${pretty}: ${beforeStr} → ${afterStr}`);
    }
  }

  lines.push("");
  lines.push(
    "Do you confirm? Click confirm to apply these changes, or cancel to abort."
  );

  const meta = {
    type: "wizard_confirm",
    wizard: "update_product",
    action: "update",
    productId,
    productName,
    description,   // <<< NEW: this will be shown inside the modal
    summary,       // rows for the modal
    changes        // extra data if you ever need it
  };

  lines.push("");
  lines.push("[[WIZARD_CONFIRM_META]]");
  lines.push(JSON.stringify(meta));
  lines.push("[[END_WIZARD_CONFIRM_META]]");

  return lines.join("\n");
}




async function handleConfirmStage(
  sessionId: string,
  state: UpdateProductWizardState,
  answer: string
): Promise<StepResult> {
  const t = answer.toLowerCase().trim();

  if (t === "cancel" || t === "no") {
    clearUpdateWizard(sessionId);
    return { reply: "Product update wizard cancelled.", done: true };
  }

  if (t !== "confirm" && t !== "yes") {
    return {
      done: false,
      reply:
        'Please click "confirm" to apply these changes or "cancel" to abort. If you left this page and came back type confirm/cancel.'
    };
  }

  const { productId, payload } = state;

  if (!productId) {
    clearUpdateWizard(sessionId);
    return {
      reply: "Internal error: missing product id.",
      done: true
    };
  }

  if (Object.keys(payload).length === 0) {
    clearUpdateWizard(sessionId);
    return {
      reply: "No fields were selected for update. Nothing changed.",
      done: true
    };
  }

  try {
    const url = process.env.WOO_URL!;
    const ck = process.env.WOO_CK!;
    const cs = process.env.WOO_CS!;

    const updated = await updateProduct(url, ck, cs, productId, payload);
    clearUpdateWizard(sessionId);

    const html = formatSingleProduct(updated);
    const summary = buildConfirmationSummary(state);

    const reply =
      "✅ Product updated successfully.\n\n"  + html;

    return { reply, done: true };
  } catch (err: any) {
    clearUpdateWizard(sessionId);
    return {
      reply: `Failed to update product: ${err.message}`,
      done: true
    };
  }
}
