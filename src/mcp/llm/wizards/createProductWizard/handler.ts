// src/mcp/llm/wizard/handler.ts

import { getWizard, setWizard, clearWizard, WizardState } from "./state";
import { createProduct } from "../../../../controllers/wooAddController";
import { formatSingleProduct } from "../../../../utils/formatWoo";
import { createWooClient } from "../../../../controllers/wooClient";

// new: client context and shared Woo resolver
import type { ToolCtx } from "../../../types";
import { resolveWooCredentials } from "../../../tools/woo/wooCredentials.js";

const WIZARD_DEBUG_JSON = process.env.WIZARD_DEBUG_JSON === "true";
console.log("Wizard Debug:", WIZARD_DEBUG_JSON);

// unified result type for all parsers
type ParseResult = {
  ok: boolean;
  value?: any;
  error?: string;
  skipped?: boolean;
};

interface Question {
  key: string;
  prompt: string;
  required?: boolean;
  parse?: (answer: string) => ParseResult;
}

/* ================================
   BASIC QUESTIONS
   ================================ */

const BASIC_QUESTIONS: Question[] = [
  {
    key: "name",
    prompt: "Product name (required)",
    required: true,
    parse: nonEmptyString
  },
  {
    key: "regular_price",
    prompt:
      "Regular price (number, for example 199.99). Type skip to leave empty",
    parse: optionalPrice
  },
  {
    key: "sale_price",
    prompt: "Sale price (number) or type skip",
    parse: optionalPrice
  },
  {
    key: "description",
    prompt:
      "Full description (you can paste text or type skip)",
    parse: optionalText
  },
  {
    key: "short_description",
    prompt: "Short description or type skip",
    parse: optionalText
  },
  {
    key: "sku",
    prompt: "SKU (stock keeping unit) or type skip",
    parse: optionalText
  },
  {
    key: "manage_stock",
    prompt:
      "Do you want WooCommerce to manage stock for this product? yes or no (default no, you can type skip)",
    parse: optionalBoolean
  },
  {
    key: "stock_quantity",
    prompt: "Stock quantity (integer) or type skip",
    parse: optionalInteger
  },
  {
    key: "stock_status",
    prompt:
      "Stock status. Type one: instock, outofstock, onbackorder. Or type skip",
    parse: optionalStockStatus
  },
  {
    key: "categories",
    prompt:
      "Categories. Type existing category names separated by comma, for example: Shirts, Summer, Men. These categories must already exist in WooCommerce, I will try to match them. Or type skip",
    parse: optionalNameListToTermArray
  },
  {
    key: "tags",
    prompt:
      "Tags. You can type names separated by comma. Or type skip",
    parse: optionalNameListToTermArray
  },
  {
    key: "meta_data",
    prompt:
      "Do you want to add custom meta data now? Type key:value pairs separated by comma (for example: color:blue, brand:nike) or type skip",
    parse: optionalMetaDataPairs
  }
];

/* ================================
   ADVANCED SECTIONS AND FIELDS
   ================================ */

const ADVANCED_SECTIONS_ORDER = [
  "pricing",
  "stock",
  "shipping",
  "virtual",
  "downloads",
  "links",
  "visibility",
  "reviews",
  "menu",
  "external"
] as const;

type AdvancedSectionName = (typeof ADVANCED_SECTIONS_ORDER)[number];

const ADVANCED_SECTION_LABELS: Record<AdvancedSectionName, string> = {
  pricing: "Advanced pricing and tax",
  stock: "Stock behavior and backorders",
  shipping: "Shipping settings and dimensions",
  virtual: "Virtual product flags",
  downloads: "Downloadable product settings",
  links: "Linked products such as upsells and cross sells",
  visibility: "Catalog visibility and featured flag",
  reviews: "Reviews and purchase notes",
  menu: "Menu order and parent product",
  external: "External url and button text (usually used for external affiliate products)"
};

const ADVANCED_QUESTIONS: Record<AdvancedSectionName, Question[]> = {
  pricing: [
    {
      key: "tax_status",
      prompt: "Tax status. Choose one: taxable, shipping, none. Or type skip",
      parse: optionalTaxStatus
    },
    {
      key: "tax_class",
      prompt:
        "Tax class (leave empty or type skip if you do not use custom tax classes)",
      parse: optionalText
    }
  ],
  stock: [
    {
      key: "backorders",
      prompt: "Backorders policy. Type one: no, notify, yes. Or type skip",
      parse: optionalBackorders
    },
    {
      key: "low_stock_amount",
      prompt: "Low stock amount threshold (integer) or type skip",
      parse: optionalInteger
    },
    {
      key: "sold_individually",
      prompt:
        "Sold individually (limit purchases to one item per order). Type yes, no or skip",
      parse: optionalBoolean
    }
  ],
  shipping: [
    {
      key: "weight",
      prompt: "Weight (for example 0.5 or 1.2) or type skip",
      parse: optionalText
    },
    {
      key: "dimensions_length",
      prompt: "Length or type skip",
      parse: optionalText
    },
    {
      key: "dimensions_width",
      prompt: "Width or type skip",
      parse: optionalText
    },
    {
      key: "dimensions_height",
      prompt: "Height or type skip",
      parse: optionalText
    },
    {
      key: "shipping_class",
      prompt: "Shipping class slug or name, or type skip",
      parse: optionalText
    }
  ],
  virtual: [
    {
      key: "virtual",
      prompt: "Is this product virtual (no shipping) yes or no or skip",
      parse: optionalBoolean
    }
  ],
  downloads: [
    {
      key: "downloadable",
      prompt: "Is this product downloadable yes or no or skip",
      parse: optionalBoolean
    },
    {
      key: "downloads",
      prompt:
        "If you want to set downloads, type one or more items in this format: name|fileUrl separated by comma. Example: Manual|https://example.com/manual.pdf, Setup|https://example.com/setup.zip. Or type skip",
      parse: optionalDownloadsList
    },
    {
      key: "download_limit",
      prompt: "Download limit (integer) or type skip",
      parse: optionalInteger
    },
    {
      key: "download_expiry",
      prompt: "Download expiry in days (integer) or type skip",
      parse: optionalInteger
    }
  ],
  links: [
    {
      key: "upsell_ids",
      prompt:
        "Upsell product ids separated by comma (for example: 12, 15) or type skip",
      parse: optionalIdList
    },
    {
      key: "cross_sell_ids",
      prompt: "Cross sell product ids separated by comma or type skip",
      parse: optionalIdList
    },
    {
      key: "grouped_products",
      prompt: "Grouped product ids separated by comma or type skip",
      parse: optionalIdList
    }
  ],
  visibility: [
    {
      key: "featured",
      prompt: "Featured product yes or no or skip",
      parse: optionalBoolean
    },
    {
      key: "catalog_visibility",
      prompt:
        "Catalog visibility. Type one: visible, catalog, search, hidden. Or type skip",
      parse: optionalCatalogVisibility
    }
  ],
  reviews: [
    {
      key: "reviews_allowed",
      prompt: "Allow customer reviews yes or no or skip",
      parse: optionalBoolean
    },
    {
      key: "purchase_note",
      prompt:
        "Purchase note that will appear after checkout, or type skip",
      parse: optionalText
    }
  ],
  menu: [
    {
      key: "menu_order",
      prompt:
        "Menu order (integer, used for ordering products) or type skip",
      parse: optionalInteger
    },
    {
      key: "parent_id",
      prompt:
        "Parent product id for grouped products or type skip",
      parse: optionalInteger
    }
  ],
  external: [
    {
      key: "external_url",
      prompt:
        "External url (for external or affiliate product) or type skip",
      parse: optionalText
    },
    {
      key: "button_text",
      prompt:
        "Button text for external product (for example Buy on Amazon) or type skip",
      parse: optionalText
    }
  ]
};

/* ================================
   PUBLIC API
   ================================ */

export function startCreateProductWizard(sessionId: string): string {
  const state: WizardState = {
    mode: "create_product",
    stage: "mode_choice",
    basicIndex: 0,
    advancedMode: "none",
    advancedSections: [],
    currentSectionIndex: 0,
    currentFieldIndex: 0,
    data: {}
  };

  setWizard(sessionId, state);

  return [
    "You want to create a new WooCommerce product.",
    "",
    "How would you like to proceed?",
    "",
    "1) Guided wizard – I will ask you step by step questions and build the product for you.",
    "2) JSON payload – you paste a raw WooCommerce product JSON body and I will validate and create it.",
    "",
    'Type "wizard" for guided mode or "json" if you want to paste a JSON payload.'
  ].join("\n");
}

// called from llm/router when wizard is active
export async function handleCreateProductWizardStep(
  sessionId: string,
  message: string,
  ctx?: ToolCtx
): Promise<{ reply: string; done: boolean }> {
  const state = getWizard(sessionId);
  if (!state) {
    return { reply: "Wizard error: no active session.", done: true };
  }

  const text = message.trim();

  if (text.toLowerCase() === "cancel") {
    clearWizard(sessionId);
    return { reply: "Product creation wizard cancelled.", done: true };
  }

  if (state.stage === "mode_choice") {
    return handleModeChoice(sessionId, state, text);
  }

  if (state.stage === "json") {
    return handleJsonStage(sessionId, state, text, ctx);
  }

  if (state.stage === "basic") {
    return handleBasicStage(sessionId, state, text);
  }

  if (state.stage === "ask_advanced") {
    return handleAskAdvancedStage(sessionId, state, text);
  }

  if (state.stage === "advanced") {
    return handleAdvancedStage(sessionId, state, text);
  }

  if (state.stage === "confirm") {
    return handleConfirmStage(sessionId, state, text, ctx);
  }

  return {
    reply: "Internal wizard state is invalid, cancelling wizard.",
    done: true
  };
}

/* ================================
   MODE CHOICE STAGE
   ================================ */

function handleModeChoice(
  sessionId: string,
  state: WizardState,
  answer: string
): { reply: string; done: boolean } {
  const t = answer.toLowerCase().trim();

  if (t === "wizard" || t === "help" || t === "guided") {
    state.stage = "basic";
    state.basicIndex = 0;
    setWizard(sessionId, state);

    const firstQuestion = BASIC_QUESTIONS[0].prompt;
    return {
      reply: [
        "Great, we will use the guided product creation wizard.",
        "",
        "You can type skip for any non required field.",
        "",
        `First question: ${firstQuestion}`
      ].join("\n"),
      done: false
    };
  }

  if (t === "json" || t === "payload" || t === "raw") {
    state.stage = "json";
    setWizard(sessionId, state);

    return {
      reply: [
        "Okay, JSON mode selected.",
        "",
        "Please paste a JSON object representing a WooCommerce product,",
        "similar to the body you would send to:",
        "  POST /wp-json/wc/v3/products",
        "",
        'Minimal example: { "name": "My product", "type": "simple", "regular_price": "19.99" }',
        "",
        "I will validate the JSON and create the product for you.",
        "If you change your mind, type cancel."
      ].join("\n"),
      done: false
    };
  }

  return {
    reply:
      'Please type "wizard" for guided mode or "json" to paste a JSON payload.',
    done: false
  };
}

/* ================================
   JSON STAGE
   ================================ */

async function handleJsonStage(
  sessionId: string,
  state: WizardState,
  answer: string,
  ctx?: ToolCtx
): Promise<{ reply: string; done: boolean }> {
  const t = answer.trim();
  const lower = t.toLowerCase();

  if (lower === "cancel") {
    clearWizard(sessionId);
    return { reply: "Product creation wizard cancelled.", done: true };
  }

  const hasPendingJson =
    state.data && (state.data as any).__json_pending === true;

  if (hasPendingJson) {
    const storedPayload = (state.data as any).__json_payload as
      | any
      | undefined;

    if (!storedPayload || typeof storedPayload !== "object") {
      clearWizard(sessionId);
      return {
        reply: "Internal wizard error: missing JSON payload. Cancelling.",
        done: true
      };
    }

    const uiMatch = t.match(/^__JSON_CONFIRM__:(publish|draft)$/i);
    if (uiMatch) {
      const chosenStatus = uiMatch[1].toLowerCase();
      storedPayload.status = chosenStatus;
    } else if (lower === "publish" || lower === "draft") {
      storedPayload.status = lower;
    } else if (lower === "no") {
      clearWizard(sessionId);
      return {
        reply: "Product creation from JSON cancelled.",
        done: true
      };
    } else if (lower === "confirm" || lower === "yes") {
      // use status from JSON as is
    } else {
      return {
        reply:
          "To finish creating this product from JSON, type:\n" +
          "• publish  → create and set status to publish\n" +
          "• draft    → create and set status to draft\n" +
          "• confirm  → create using the status inside the JSON\n" +
          "• cancel   → cancel product creation\n",
        done: false
      };
    }

    try {
      const { url, ck, cs } = resolveWooCredentials({}, ctx);

      const created = await createProduct(url, ck, cs, storedPayload);
      clearWizard(sessionId);

      const html = formatSingleProduct(created);

      let reply =
        "Product created successfully from JSON payload.\n\n" + html;

      if (WIZARD_DEBUG_JSON) {
        const debugJson = JSON.stringify(storedPayload, null, 2);
        reply +=
          "\n\n" +
          `<details class="details">
  <summary>Debug (session ${sessionId}): JSON payload sent to WooCommerce</summary>
  <pre class="code">${escapeHtml(debugJson)}</pre>
</details>`;
      }

      return {
        reply,
        done: true
      };
    } catch (err: any) {
      clearWizard(sessionId);
      return {
        reply: `Failed to create product from JSON: ${err.message}`,
        done: true
      };
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(t);
  } catch (err: any) {
    return {
      reply:
        `This is not valid JSON: ${err.message}\n\n` +
        "Please paste a valid JSON object or type cancel.",
      done: false
    };
  }

  if (!payload || typeof payload !== "object") {
    return {
      reply:
        'The JSON must be an object, for example { "name": "Product" }. Please try again or type cancel.',
      done: false
    };
  }

  if (!payload.name || typeof payload.name !== "string") {
    return {
      reply:
        'The JSON must include a product name: "name": "Your product name".',
      done: false
    };
  }

  if (!payload.type) {
    payload.type = "simple";
  }

  if (!state.data) {
    state.data = {};
  }
  (state.data as any).__json_pending = true;
  (state.data as any).__json_payload = payload;
  setWizard(sessionId, state);

  const lines: string[] = [];
  lines.push("Here is the product parsed from your JSON payload.");
  lines.push("");
  lines.push(
    "Click confirm to create this product from JSON, or choose publish/draft for status.\n" +
      "You can also click cancel to abort."
  );
  lines.push("");

  const humanText = lines.join("\n");

  const catSummary =
    Array.isArray(payload.categories) && payload.categories.length
      ? payload.categories
          .map((c: any) => c?.name ?? c?.slug ?? c?.id ?? "")
          .filter(Boolean)
          .join(", ")
      : "(none)";

  const tagSummary =
    Array.isArray(payload.tags) && payload.tags.length
      ? payload.tags
          .map((t: any) => t?.name ?? t?.slug ?? t?.id ?? "")
          .filter(Boolean)
          .join(", ")
      : "(none)";

  const dimSummaryJson =
    [
      payload.dimensions?.length,
      payload.dimensions?.width,
      payload.dimensions?.height
    ]
      .filter(Boolean)
      .join(" x ") || null;

  const meta = {
    type: "wizard_confirm",
    wizard: "create_product",
    action: "create_from_json",
    productName: payload.name ?? null,
    description: humanText,
    sessionId,
    summary: {
      regular_price: payload.regular_price ?? null,
      sale_price: payload.sale_price ?? null,
      status: payload.status ?? null,
      sku: payload.sku ?? null,
      stock_quantity: payload.stock_quantity ?? null,
      stock_status: payload.stock_status ?? null,
      manage_stock: payload.manage_stock ?? null,
      categories: catSummary,
      tags: tagSummary,
      description: payload.description ?? null,
      short_description: payload.short_description ?? null,
      virtual: payload.virtual ?? null,
      downloadable: payload.downloadable ?? null,
      weight: payload.weight ?? null,
      dimensions: dimSummaryJson,
      backorders: payload.backorders ?? null,
      low_stock_amount: payload.low_stock_amount ?? null,
      sold_individually: payload.sold_individually ?? null,
      featured: payload.featured ?? null,
      catalog_visibility: payload.catalog_visibility ?? null,
      reviews_allowed: payload.reviews_allowed ?? null,
      purchase_note: payload.purchase_note ?? null,
      external_url: payload.external_url ?? null,
      button_text: payload.button_text ?? null,
      meta_data:
        Array.isArray(payload.meta_data) && payload.meta_data.length
          ? payload.meta_data.map((m: any) => `${m.key}:${m.value}`).join(", ")
          : null
    }
  };

  const reply =
    humanText +
    "\n\n[[WIZARD_CONFIRM_META]]\n" +
    JSON.stringify(meta) +
    "\n[[END_WIZARD_CONFIRM_META]]";

  return {
    reply,
    done: false
  };
}

/* ================================
   BASIC STAGE
   ================================ */

function handleBasicStage(
  sessionId: string,
  state: WizardState,
  answer: string
): { reply: string; done: boolean } {
  const idx = state.basicIndex;
  const question = BASIC_QUESTIONS[idx];

  const parse = question.parse ?? nonEmptyString;
  const result = parse(answer);

  if (!result.ok && !result.skipped) {
    return {
      reply: result.error ?? "Please enter a valid value.",
      done: false
    };
  }

  if (!result.skipped) {
    state.data[question.key] = result.value;
  }

  state.basicIndex += 1;

  if (state.basicIndex >= BASIC_QUESTIONS.length) {
    state.stage = "ask_advanced";
    setWizard(sessionId, state);

    return {
      reply: [
        "Basic fields are done.",
        "",
        "Do you want to configure advanced options as well?",
        "You can answer one of these:",
        "- none        → finish with basic fields only",
        "- full        → go through all advanced sections",
        "- sections    → choose which areas, for example: shipping, stock, visibility"
      ].join("\n"),
      done: false
    };
  }

  setWizard(sessionId, state);

  const nextQuestion = BASIC_QUESTIONS[state.basicIndex].prompt;
  return { reply: nextQuestion, done: false };
}

/* ================================
   ASK ADVANCED STAGE
   ================================ */

function handleAskAdvancedStage(
  sessionId: string,
  state: WizardState,
  answer: string
): { reply: string; done: boolean } {
  const t = answer.toLowerCase().trim();

  if (t === "none" || t === "no") {
    state.advancedMode = "none";
    state.stage = "confirm";
    setWizard(sessionId, state);
    return {
      reply: buildConfirmationSummary(sessionId, state),
      done: false
    };
  }

  if (t === "full") {
    state.advancedMode = "full";
    state.advancedSections = [...ADVANCED_SECTIONS_ORDER];
    state.currentSectionIndex = 0;
    state.currentFieldIndex = 0;
    state.stage = "advanced";
    setWizard(sessionId, state);

    const firstSection = state.advancedSections[0] as AdvancedSectionName;
    const firstQuestion = ADVANCED_QUESTIONS[firstSection][0].prompt;

    return {
      reply:
        "Advanced mode enabled (full).\n\n" +
        `Section: ${ADVANCED_SECTION_LABELS[firstSection]}\n` +
        firstQuestion,
      done: false
    };
  }

  if (t === "sections") {
    state.advancedMode = "sections";
    state.stage = "advanced";
    state.currentSectionIndex = 0;
    state.currentFieldIndex = 0;

    setWizard(sessionId, state);

    const available = ADVANCED_SECTIONS_ORDER
      .map((s) => `${s} = ${ADVANCED_SECTION_LABELS[s]}`)
      .join("\n");

    return {
      reply: [
        "Please type which advanced areas you want, separated by comma.",
        "For example: shipping, stock, visibility",
        "",
        "Available areas:",
        available
      ].join("\n"),
      done: false
    };
  }

  return {
    reply: "Please answer: none, full, or sections.",
    done: false
  };
}

/* ================================
   ADVANCED STAGE
   ================================ */

function handleAdvancedStage(
  sessionId: string,
  state: WizardState,
  answer: string
): { reply: string; done: boolean } {
  if (state.advancedMode === "sections" && state.advancedSections.length === 0) {
    const selected = parseAdvancedSections(answer);
    if (!selected.length) {
      return {
        reply:
          "I could not detect any valid section names. Please choose from: " +
          ADVANCED_SECTIONS_ORDER.join(", "),
        done: false
      };
    }

    state.advancedSections = selected;
    state.currentSectionIndex = 0;
    state.currentFieldIndex = 0;
    setWizard(sessionId, state);
  } else {
    const sectionName = state.advancedSections[
      state.currentSectionIndex
    ] as AdvancedSectionName;
    const questions = ADVANCED_QUESTIONS[sectionName];

    const q = questions[state.currentFieldIndex];
    const parse = q.parse ?? optionalText;
    const result = parse(answer);

    if (!result.ok && !result.skipped) {
      return {
        reply: result.error ?? "Please enter a valid value.",
        done: false
      };
    }

    if (!result.skipped) {
      applyAdvancedFieldToData(state.data, q.key, result.value);
    }

    state.currentFieldIndex += 1;

    if (state.currentFieldIndex >= questions.length) {
      state.currentSectionIndex += 1;
      state.currentFieldIndex = 0;
    }

    if (state.currentSectionIndex >= state.advancedSections.length) {
      state.stage = "confirm";
      setWizard(sessionId, state);
      return { reply: buildConfirmationSummary(sessionId, state), done: false };
    }

    setWizard(sessionId, state);
  }

  const currentSection = state.advancedSections[
    state.currentSectionIndex
  ] as AdvancedSectionName;
  const questions = ADVANCED_QUESTIONS[currentSection];
  const q = questions[state.currentFieldIndex];

  return {
    reply: `Section: ${ADVANCED_SECTION_LABELS[currentSection]}\n` + q.prompt,
    done: false
  };
}

/* ================================
   CONFIRM STAGE
   ================================ */

async function createProductFromState(
  state: WizardState,
  ctx?: ToolCtx
): Promise<{ created: any; payload: any }> {
  const { url, ck, cs } = resolveWooCredentials({}, ctx);

  const payload: any = {
    type: "simple",
    name: state.data.name,
    status: state.data.status,
    regular_price: toStringIfDefined(state.data.regular_price),
    sale_price: toStringIfDefined(state.data.sale_price),
    description: state.data.description,
    short_description: state.data.short_description,
    sku: state.data.sku,
    manage_stock: state.data.manage_stock,
    stock_quantity: state.data.stock_quantity,
    stock_status: state.data.stock_status,
    categories: state.data.categories,
    tags: state.data.tags,
    meta_data: state.data.meta_data,
    tax_status: state.data.tax_status,
    tax_class: state.data.tax_class,
    backorders: state.data.backorders,
    low_stock_amount: state.data.low_stock_amount,
    sold_individually: state.data.sold_individually,
    weight: state.data.weight,
    dimensions: {
      length: state.data.dimensions_length,
      width: state.data.dimensions_width,
      height: state.data.dimensions_height
    },
    shipping_class: state.data.shipping_class,
    virtual: state.data.virtual,
    downloadable: state.data.downloadable,
    downloads: state.data.downloads,
    download_limit: state.data.download_limit,
    download_expiry: state.data.download_expiry,
    upsell_ids: state.data.upsell_ids,
    cross_sell_ids: state.data.cross_sell_ids,
    grouped_products: state.data.grouped_products,
    featured: state.data.featured,
    catalog_visibility: state.data.catalog_visibility,
    reviews_allowed: state.data.reviews_allowed,
    purchase_note: state.data.purchase_note,
    menu_order: state.data.menu_order,
    parent_id: state.data.parent_id,
    external_url: state.data.external_url,
    button_text: state.data.button_text
  };

  const hasCategories =
    Array.isArray(state.data.categories) && state.data.categories.length > 0;
  const hasTags =
    Array.isArray(state.data.tags) && state.data.tags.length > 0;

  if (hasCategories || hasTags) {
    const api = createWooClient(url, ck, cs);

    if (hasCategories) {
      const resolvedCats: { id: number }[] = [];

      for (const term of state.data.categories as any[]) {
        const name = term?.name;
        if (!name) continue;

        const resp = await api.get("products/categories", {
          per_page: 50,
          search: name
        });

        if (Array.isArray(resp.data) && resp.data.length) {
          resolvedCats.push({ id: resp.data[0].id });
        }
      }

      if (resolvedCats.length) {
        payload.categories = resolvedCats;
      }
    }

    if (hasTags) {
      const resolvedTags: { id: number }[] = [];

      for (const term of state.data.tags as any[]) {
        const name = term?.name;
        if (!name) continue;

        const resp = await api.get("products/tags", {
          per_page: 50,
          search: name
        });

        if (Array.isArray(resp.data) && resp.data.length) {
          resolvedTags.push({ id: resp.data[0].id });
        }
      }

      if (resolvedTags.length) {
        payload.tags = resolvedTags;
      }
    }
  }

  Object.keys(payload).forEach((k) => {
    if (payload[k] === undefined) {
      delete payload[k];
    }
  });

  const created = await createProduct(url, ck, cs, payload);
  return { created, payload };
}

function buildConfirmationSummary(
  sessionId: string,
  state: WizardState
): string {
  const d = state.data;

  const lines: string[] = [];
  lines.push(
    "Here is the product summary. If this looks correct, Click confirm."
  );
  lines.push("If you want to cancel, type cancel.");
  lines.push("");

  lines.push(`Name: ${d.name ?? "(missing)"}`);
  lines.push(`Regular price: ${d.regular_price ?? "(none)"}`);
  lines.push(`Sale price: ${d.sale_price ?? "(none)"}`);
  lines.push(`Status: ${d.status ?? "(not chosen yet)"}`);
  lines.push(`SKU: ${d.sku ?? "(none)"}`);
  lines.push(`Stock quantity: ${d.stock_quantity ?? "(none)"}`);
  lines.push(`Stock status: ${d.stock_status ?? "(none)"}`);
  lines.push(`Manage stock: ${stringOrDash(d.manage_stock)}`);
  lines.push("");
  lines.push(`Categories: ${safeSummaryArray(d.categories)}`);
  lines.push(`Tags: ${safeSummaryArray(d.tags)}`);
  lines.push("");
  lines.push(`Description: ${stringOrDash(d.description)}`);
  lines.push(`Short description: ${stringOrDash(d.short_description)}`);
  lines.push("");
  lines.push(`Virtual: ${stringOrDash(d.virtual)}`);
  lines.push(`Downloadable: ${stringOrDash(d.downloadable)}`);
  lines.push(`Weight: ${stringOrDash(d.weight)}`);
  lines.push(
    `Dimensions: ${stringOrDash(
      [d.dimensions_length, d.dimensions_width, d.dimensions_height]
        .filter(Boolean)
        .join(" x ")
    )}`
  );
  lines.push("");
  lines.push(`Backorders: ${stringOrDash(d.backorders)}`);
  lines.push(`Low stock amount: ${stringOrDash(d.low_stock_amount)}`);
  lines.push(`Sold individually: ${stringOrDash(d.sold_individually)}`);
  lines.push("");
  lines.push(`Featured: ${stringOrDash(d.featured)}`);
  lines.push(`Catalog visibility: ${stringOrDash(d.catalog_visibility)}`);
  lines.push("");
  lines.push(`Reviews allowed: ${stringOrDash(d.reviews_allowed)}`);
  lines.push(`Purchase note: ${stringOrDash(d.purchase_note)}`);
  lines.push("");
  lines.push(`External url: ${stringOrDash(d.external_url)}`);
  lines.push(`Button text: ${stringOrDash(d.button_text)}`);
  lines.push("");
  lines.push("Type confirm to create the product, or cancel to abort.");

  const humanText = lines.join("\n");

  const dimSummary =
    [d.dimensions_length, d.dimensions_width, d.dimensions_height]
      .filter(Boolean)
      .join(" x ") || null;

  const meta = {
    type: "wizard_confirm",
    wizard: "create_product",
    action: "create",
    productName: d.name ?? null,
    description: humanText,
    sessionId,
    summary: {
      regular_price: d.regular_price ?? null,
      sale_price: d.sale_price ?? null,
      status: d.status ?? null,
      sku: d.sku ?? null,
      stock_quantity: d.stock_quantity ?? null,
      stock_status: d.stock_status ?? null,
      manage_stock: d.manage_stock ?? null,
      categories: safeSummaryArray(d.categories),
      tags: safeSummaryArray(d.tags),
      description: d.description ?? null,
      short_description: d.short_description ?? null,
      virtual: d.virtual ?? null,
      downloadable: d.downloadable ?? null,
      weight: d.weight ?? null,
      dimensions: dimSummary,
      backorders: d.backorders ?? null,
      low_stock_amount: d.low_stock_amount ?? null,
      sold_individually: d.sold_individually ?? null,
      featured: d.featured ?? null,
      catalog_visibility: d.catalog_visibility ?? null,
      reviews_allowed: d.reviews_allowed ?? null,
      purchase_note: d.purchase_note ?? null,
      external_url: d.external_url ?? null,
      button_text: d.button_text ?? null,
      meta_data:
        Array.isArray(d.meta_data) && d.meta_data.length
          ? d.meta_data.map((m: any) => `${m.key}:${m.value}`).join(", ")
          : null
    }
  };

  const reply =
    humanText +
    "\n\n[[WIZARD_CONFIRM_META]]\n" +
    JSON.stringify(meta) +
    "\n[[END_WIZARD_CONFIRM_META]]";

  return reply;
}

function stringOrDash(v: any): string {
  if (v === undefined || v === null || v === "") return "—";
  return String(v);
}

function safeSummaryArray(arr: any): string {
  if (!Array.isArray(arr) || arr.length === 0) return "(none)";
  return arr
    .map((x: any) => x?.name ?? x?.slug ?? x?.id ?? String(x))
    .join(", ");
}

function toStringIfDefined(v: any): string | undefined {
  if (v === undefined || v === null || v === "") return undefined;
  return String(v);
}

async function handleConfirmStage(
  sessionId: string,
  state: WizardState,
  answer: string,
  ctx?: ToolCtx
): Promise<{ reply: string; done: boolean }> {
  const raw = answer.trim();
  const t = raw.toLowerCase();

  const uiMatch = raw.match(/^__WIZ_CONFIRM__:(publish|draft)$/i);
  if (uiMatch) {
    const chosenStatus = uiMatch[1].toLowerCase();
    state.data.status = chosenStatus;
    setWizard(sessionId, state);

    try {
      const { created, payload } = await createProductFromState(state, ctx);
      clearWizard(sessionId);

      const html = formatSingleProduct(created);

      let reply = "Product created successfully.\n\n" + html;

      if (WIZARD_DEBUG_JSON) {
        const debugJson = JSON.stringify(payload, null, 2);
        reply +=
          "\n\n" +
          `<details class="details">
  <summary>Debug (session ${sessionId}): JSON payload sent to WooCommerce</summary>
  <pre class="code">${escapeHtml(debugJson)}</pre>
</details>`;
      }

      return {
        reply,
        done: true
      };
    } catch (err: any) {
      clearWizard(sessionId);
      return {
        reply: `Failed to create product: ${err.message}`,
        done: true
      };
    }
  }

  if (t === "publish" || t === "published") {
    state.data.status = "publish";
    setWizard(sessionId, state);
    return {
      reply:
        "Status set to publish.\n" +
        "If everything looks good, click confirm to create the product or type cancel to abort. If you left this page and came back type confirm/cancel.",
      done: false
    };
  }

  if (t === "draft") {
    state.data.status = "draft";
    setWizard(sessionId, state);
    return {
      reply:
        "Status set to draft.\n" +
        "If everything looks good, click confirm to create the product or type cancel to abort. If you left this page and came back type confirm/cancel.",
      done: false
    };
  }

  if (t === "confirm" || t === "yes") {
    if (!state.data.status) {
      return {
        reply:
          "Before I create the product, should it be published or saved as draft?\n" +
          "click publish or draft. If you left this page and came back type publish/draft.",
        done: false
      };
    }

    try {
      const { created, payload } = await createProductFromState(state, ctx);
      clearWizard(sessionId);

      const html = formatSingleProduct(created);

      let reply = "Product created successfully.\n\n" + html;

      if (WIZARD_DEBUG_JSON) {
        const debugJson = JSON.stringify(payload, null, 2);
        reply +=
          "\n\n" +
          `<details class="details">
  <summary>Debug (session ${sessionId}): JSON payload sent to WooCommerce</summary>
  <pre class="code">${escapeHtml(debugJson)}</pre>
</details>`;
      }

      return {
        reply,
        done: true
      };
    } catch (err: any) {
      clearWizard(sessionId);
      return {
        reply: `Failed to create product: ${err.message}`,
        done: true
      };
    }
  }

  if (t === "cancel" || t === "no") {
    clearWizard(sessionId);
    return { reply: "Product creation wizard cancelled.", done: true };
  }

  return {
    reply:
      "To finish, type one of the following:\n" +
      "publish  → publish the product and then confirm\n" +
      "draft    → save the product as draft and then confirm\n" +
      "confirm  → create the product with the chosen status\n" +
      "cancel   → cancel the wizard",
    done: false
  };
}

/* ================================
   PARSERS AND HELPERS
   ================================ */

function nonEmptyString(answer: string): ParseResult {
  const v = answer.trim();
  if (!v) {
    return {
      ok: false,
      error: "This field is required. Please enter a value."
    };
  }
  return { ok: true, value: v };
}

function optionalText(answer: string): ParseResult {
  const t = answer.trim();
  if (t.toLowerCase() === "skip" || t === "") {
    return { ok: true, skipped: true };
  }
  return { ok: true, value: t };
}

function optionalPrice(answer: string): ParseResult {
  const t = answer.trim();
  if (t.toLowerCase() === "skip" || t === "") {
    return { ok: true, skipped: true };
  }
  const n = Number(t);
  if (Number.isNaN(n) || n < 0) {
    return {
      ok: false,
      error: "Please type a valid positive number or skip."
    };
  }
  return { ok: true, value: n.toFixed(2) };
}

function optionalInteger(answer: string): ParseResult {
  const t = answer.trim();
  if (t.toLowerCase() === "skip" || t === "") {
    return { ok: true, skipped: true };
  }
  const n = Number(t);
  if (!Number.isInteger(n)) {
    return {
      ok: false,
      error: "Please type a valid integer or skip."
    };
  }
  return { ok: true, value: n };
}

function optionalBoolean(answer: string): ParseResult {
  const t = answer.trim().toLowerCase();
  if (t === "skip" || t === "") return { ok: true, skipped: true };
  if (t === "yes" || t === "y" || t === "true") {
    return { ok: true, value: true };
  }
  if (t === "no" || t === "n" || t === "false") {
    return { ok: true, value: false };
  }
  return {
    ok: false,
    error: "Please type yes, no, or skip."
  };
}

function optionalStockStatus(answer: string): ParseResult {
  const t = answer.trim().toLowerCase();
  if (t === "skip" || t === "") return { ok: true, skipped: true };
  if (t === "instock" || t === "outofstock" || t === "onbackorder") {
    return { ok: true, value: t };
  }
  return {
    ok: false,
    error:
      "Please type one of: instock, outofstock, onbackorder, or skip."
  };
}

function optionalTaxStatus(answer: string): ParseResult {
  const t = answer.trim().toLowerCase();
  if (t === "skip" || t === "") return { ok: true, skipped: true };
  if (t === "taxable" || t === "shipping" || t === "none") {
    return { ok: true, value: t };
  }
  return {
    ok: false,
    error: "Please type one of: taxable, shipping, none, or skip."
  };
}

function optionalBackorders(answer: string): ParseResult {
  const t = answer.trim().toLowerCase();
  if (t === "skip" || t === "") return { ok: true, skipped: true };
  if (t === "no" || t === "notify" || t === "yes") {
    return { ok: true, value: t };
  }
  return {
    ok: false,
    error: "Please type one of: no, notify, yes, or skip."
  };
}

function optionalCatalogVisibility(answer: string): ParseResult {
  const t = answer.trim().toLowerCase();
  if (t === "skip" || t === "") return { ok: true, skipped: true };
  if (
    t === "visible" ||
    t === "catalog" ||
    t === "search" ||
    t === "hidden"
  ) {
    return { ok: true, value: t };
  }
  return {
    ok: false,
    error:
      "Please type one of: visible, catalog, search, hidden, or skip."
  };
}

function optionalNameListToTermArray(answer: string): ParseResult {
  const t = answer.trim();
  if (t.toLowerCase() === "skip" || t === "") {
    return { ok: true, skipped: true };
  }

  const parts = t
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) {
    return {
      ok: false,
      error:
        "Please type one or more names separated by comma, or skip."
    };
  }

  const terms = parts.map((name) => ({ name }));
  return { ok: true, value: terms };
}

function optionalMetaDataPairs(answer: string): ParseResult {
  const t = answer.trim();
  if (t.toLowerCase() === "skip" || t === "") {
    return { ok: true, skipped: true };
  }

  const pairs = t
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!pairs.length) {
    return {
      ok: false,
      error:
        "Please type key:value pairs separated by comma, or skip."
    };
  }

  const meta: { key: string; value: string }[] = [];
  for (const pair of pairs) {
    const [k, v] = pair.split(":").map((x) => x.trim());
    if (!k || v === undefined) {
      return {
        ok: false,
        error:
          "Each meta pair must look like key:value. Example: color:blue, brand:nike"
      };
    }
    meta.push({ key: k, value: v });
  }

  return { ok: true, value: meta };
}

function optionalDownloadsList(answer: string): ParseResult {
  const t = answer.trim();
  if (t.toLowerCase() === "skip" || t === "") {
    return { ok: true, skipped: true };
  }

  const items = t
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!items.length) {
    return {
      ok: false,
      error:
        "Please enter at least one download in format name|url or type skip."
    };
  }

  const downloads: { name: string; file: string }[] = [];
  for (const item of items) {
    const [name, file] = item.split("|").map((x) => x.trim());
    if (!name || !file) {
      return {
        ok: false,
        error:
          "Each download must look like name|url. Example: Manual|https://example.com/file.pdf"
      };
    }
    downloads.push({ name, file });
  }

  return { ok: true, value: downloads };
}

function optionalIdList(answer: string): ParseResult {
  const t = answer.trim();
  if (t.toLowerCase() === "skip" || t === "") {
    return { ok: true, skipped: true };
  }

  const items = t
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!items.length) {
    return {
      ok: false,
      error:
        "Please type one or more ids separated by comma, or skip."
    };
  }

  const ids: number[] = [];
  for (const it of items) {
    const n = Number(it);
    if (!Number.isInteger(n) || n <= 0) {
      return {
        ok: false,
        error:
          "Each id must be a positive integer, or type skip."
      };
    }
    ids.push(n);
  }

  return { ok: true, value: ids };
}

function parseAdvancedSections(answer: string): AdvancedSectionName[] {
  const t = answer.toLowerCase();
  const tokens = t
    .split(/[,;]+/)
    .map((x) => x.trim())
    .filter(Boolean);

  const result: AdvancedSectionName[] = [];

  for (const token of tokens) {
    for (const section of ADVANCED_SECTIONS_ORDER) {
      if (token === section || token.includes(section)) {
        if (!result.includes(section)) {
          result.push(section);
        }
      }
    }
  }

  return result;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function applyAdvancedFieldToData(
  data: Record<string, any>,
  key: string,
  value: any
): void {
  if (value === undefined) return;

  if (key.startsWith("dimensions_")) {
    const dimensionKey = key.replace("dimensions_", "");
    data[`dimensions_${dimensionKey}`] = value;
    return;
  }

  data[key] = value;
}
