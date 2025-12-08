// src/controllers/wooUpdateController.ts
import { createWooClient } from "./wooClient";
import { getProductBySku} from "./wooGetController"; // adjust path if needed

// ======================================================
// CORE: update product by ID (your original function)
// ======================================================
export async function updateProduct(
  url: string,
  ck: string,
  cs: string,
  id: number | string,
  payload: Record<string, any>
) {
  const api = createWooClient(url, ck, cs);

  const pid = typeof id === "string" ? parseInt(id, 10) : id;

  if (!pid || Number.isNaN(pid)) {
    throw new Error("Invalid product ID for update");
  }

  if (!payload || typeof payload !== "object") {
    throw new Error("Missing update payload");
  }

  try {
    const res = await api.put(`products/${pid}`, payload);
    return res.data;
  } catch (err: any) {
    throw new Error(`WooCommerce updateProductById failed: ${err.message}`);
  }
}

// ======================================================
// NEW: update product by SKU
// - finds product via getProductBySku
// - delegates to updateProduct by id
// ======================================================
export async function updateProductBySku(
  url: string,
  ck: string,
  cs: string,
  sku: string,
  payload: Record<string, any>
) {
  if (!sku || typeof sku !== "string") {
    throw new Error("SKU is required for updateProductBySku");
  }

  const found = await getProductBySku(url, ck, cs, sku);

  // handle both array and single object
  const product = Array.isArray(found) ? found[0] : found;

  if (!product) {
    throw new Error(`No product found with SKU "${sku}".`);
  }

  const pid = product.id ?? product.ID;
  if (!pid) {
    throw new Error(
      `Product resolved from SKU "${sku}" does not contain an id field.`
    );
  }

  return updateProduct(url, ck, cs, pid, payload);
}


