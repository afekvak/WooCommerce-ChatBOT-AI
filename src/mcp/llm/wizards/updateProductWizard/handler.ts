import { z } from "zod";
// src/mcp/llm/updateproductwizard/handler.ts

import {
  getUpdateWizard,
  setUpdateWizard,
  clearUpdateWizard,
  UpdateProductWizardState
} from "./state";

import {
  getProductById,
  getProductBySku
} from "../../../../services/productService";

import { updateProduct } from "../../../../services/productService";
import { formatProducts } from "../../../../utils/formatWoo";

// NEW: bring in ToolCtx and shared Woo credential resolver
import type { ToolCtx } from "../../../types";
import { resolveWooCredentials } from "../../../tools/woo/wooCredentials.js";
import {validateProductChanges, applyImageChange, type ImageChange} from "../../../../services/productSchema";
import { updateChangesSchema } from "../../../tools/workflowSchemas";

type StepResult = { reply: string; done: boolean };

// fields we allow the wizard to edit
const ALLOWED_UPDATE_FIELDS = Object.keys(updateChangesSchema.shape);

// ================================
// PUBLIC API
// ================================

export async function startUpdateProductWizard(
  sessionId: string,
  target: { id?: number; sku?: string; changes?: Record<string, unknown>; imageChange?: ImageChange; priceAdjustment?: { field: "regular_price" | "sale_price"; direction: "increase" | "decrease"; percent: number } },
  ctx?: ToolCtx
): Promise<StepResult> {
  // IMPORTANT: use client / env credentials, not hard-coded env only
  const { url, ck, cs } = resolveWooCredentials({}, ctx);

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

  if (target.priceAdjustment) {
    const { field, direction, percent } = target.priceAdjustment;
    const current = Number(original[field]);
    if (original[field] === "" || original[field] == null || !Number.isFinite(current) || current < 0 || (direction === "decrease" && percent > 100) || target.changes?.[field] !== undefined) {
      return { done: true, reply: "I need a valid existing price and one unambiguous price change before preparing this update." };
    }
    target = { ...target, changes: { ...target.changes, [field]: (Math.round(current * (1 + (direction === "increase" ? 1 : -1) * percent / 100) * 100) / 100).toFixed(2) } };
  }
  if (target.imageChange) {
    if (target.changes?.images !== undefined) return {done:true,reply:"Please choose one image operation rather than supplying both imageChange and images."};
    try { target = { ...target, changes: { ...target.changes, images: applyImageChange(original, target.imageChange) } }; }
    catch (error) { return {done:true,reply:error instanceof Error ? error.message : "Invalid image change."}; }
  }
  if (target.changes) target.changes = validateProductChanges(target.changes);
  const state: UpdateProductWizardState = {
    stage: "choose_fields",
    productId,
    originalProduct: original,
    fieldKeys: [],
    fieldIndex: 0,
    payload: {}
  };

  setUpdateWizard(sessionId, state);

  if (target.changes && Object.keys(target.changes).length) {
    state.payload = updateChangesSchema.parse(target.changes);
    state.fieldKeys = Object.keys(state.payload);
    state.stage = "confirm";
    return { done: false, reply: buildConfirmationSummary(state) };
  }

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
  message: string,
  ctx?: ToolCtx
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
    return handleConfirmStage(sessionId, state, text, ctx);
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
    let value: unknown = t;
    const fieldSchema = updateChangesSchema.shape[field as keyof typeof updateChangesSchema.shape];
    const underlying = fieldSchema.unwrap();
    try {
      if (underlying instanceof z.ZodNullable && t === "null") value = null;
      else if (underlying instanceof z.ZodBoolean) {
        if (/^(yes|y|true)$/i.test(t)) value = true;
        else if (/^(no|n|false)$/i.test(t)) value = false;
      } else if (underlying instanceof z.ZodNumber) value = Number(t);
      else if (underlying instanceof z.ZodArray || underlying instanceof z.ZodObject) {
        value = field === "images" && /^https?:\/\//i.test(t) ? applyImageChange(state.originalProduct, {mode:"replace_featured",images:[{src:t}]}) : JSON.parse(t);
      }
      value = fieldSchema.parse(value);
      validateProductChanges({[field]:value});
    } catch { return {done:false,reply:"That value is not valid for " + field + ". Use a valid value (JSON for lists/objects), or skip."}; }

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
          : typeof before === "object" ? JSON.stringify(before) : String(before);
      const afterStr =
        after === undefined || after === null || after === ""
          ? "(none)"
          : typeof after === "object" ? JSON.stringify(after) : String(after);

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
    description,
    summary,
    changes
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
  answer: string,
  ctx?: ToolCtx
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
    // IMPORTANT: again, use client-aware credentials
    const { url, ck, cs } = resolveWooCredentials({}, ctx);

    if (payload.images !== undefined) {
      const fresh = await getProductById(url, ck, cs, productId);
      const identity = (images: any[]) => JSON.stringify((images || []).map(image => ({id:image.id,src:image.src})));
      if (identity(fresh.images) !== identity(state.originalProduct.images)) {
        clearUpdateWizard(sessionId);
        return {done:true,reply:"This product's images changed after the preview. Ask for the image change again so I can preserve the current gallery."};
      }
    }
    const updated = await updateProduct(url, ck, cs, productId, validateProductChanges(payload));
    clearUpdateWizard(sessionId);

    const html = formatProducts([updated]);

    const reply = "✅ Product updated successfully.\n\n" + html;

    return { reply, done: true };
  } catch (err: any) {
    clearUpdateWizard(sessionId);
    return {
      reply: `Failed to update product: ${err.message}`,
      done: true
    };
  }
}
