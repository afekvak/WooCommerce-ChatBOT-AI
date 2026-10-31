import { createWooClient } from "../controllers/wooClient";

type Payload = Record<string, any>;
type Params = Record<string, unknown>;

/** Narrow transport boundary so product behavior can be tested without a store. */
export interface ProductApi {
  get(path: string, params?: Params): Promise<{ data: any }>;
  post(path: string, data: unknown): Promise<{ data: any }>;
  put(path: string, data: unknown): Promise<{ data: any }>;
}

function perPage(limit?: number | string): number {
  const value = typeof limit === "string" ? parseInt(limit, 10) : limit;
  return value && Number.isFinite(value) && value > 0 ? Math.max(1, Math.min(100, Math.floor(value))) : 20;
}

function productId(id: number | string): number {
  const value = typeof id === "string" ? Number(id) : id;
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error("Invalid product ID");
  return value;
}

/** Store operations only: no chat state, HTML, or confirmation UI. */
export class ProductService {
  constructor(private readonly api: ProductApi) {}

  private async request<T>(operation: string, call: () => Promise<{ data: T }>): Promise<T> {
    try {
      return (await call()).data;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } }; message?: string };
      throw new Error(`WooCommerce ${operation} failed: ${err.response?.data?.message || err.message || "Unknown error"}`);
    }
  }

  listProducts(params: Params = {}) {
    return this.request<any[]>("listProducts", () => this.api.get("products", params));
  }

  getProducts(limit?: number | string) {
    return this.listProducts({ per_page: perPage(limit) });
  }

  getProductById(id: number | string) {
    const pid = productId(id);
    return this.request("getProductById", () => this.api.get(`products/${pid}`));
  }

  getProductBySku(sku: string) {
    if (!sku.trim()) throw new Error("SKU is required");
    return this.listProducts({ sku, status: "any" });
  }

  getProductByName(name: string, limit?: number | string) {
    return this.listProducts({ search: name, per_page: perPage(limit), status: "any" });
  }

  findTerms(kind: "categories" | "tags", params: Params) {
    return this.request<any[]>(`find${kind}`, () => this.api.get(`products/${kind}`, params));
  }

  async getProductsByCategory(category?: number | string, limit?: number | string) {
    let id: number | undefined;
    if (typeof category === "number") id = productId(category);
    else if (typeof category === "string") {
      const matches = await this.findTerms("categories", { per_page: 100, slug: category });
      if (!matches.length) throw new Error(`Category slug '${category}' not found`);
      id = matches[0].id;
    }
    if (!id) throw new Error("Missing category id or slug");
    return this.listProducts({ per_page: perPage(limit), category: id });
  }

  createProduct(data: Payload) {
    return this.request("createProduct", () => this.api.post("products", data));
  }

  updateProduct(id: number | string, payload: Payload) {
    const pid = productId(id);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Missing update payload");
    }
    return this.request("updateProduct", () => this.api.put(`products/${pid}`, payload));
  }

  async updateProductBySku(sku: string, payload: Payload) {
    const matches = await this.getProductBySku(sku);
    const product = matches[0];
    if (!product) throw new Error(`No product found with SKU "${sku}".`);
    return this.updateProduct(product.id, payload);
  }

  /** Return WooCommerce's item results; HTTP success can include item errors. */
  updateProductsBatch(updates: Payload[]) {
    if (updates.length > 100) throw new Error("Batch updates support at most 100 products");
    for (const update of updates) productId(update.id);
    return this.request<{ update: Array<{ id?: number; error?: unknown }> }>(
      "updateProductsBatch", () => this.api.put("products/batch", { update: updates })
    );
  }
}

export function createProductService(url: string, ck: string, cs: string) {
  return new ProductService(createWooClient(url, ck, cs));
}

// Compatible function signatures while existing callers migrate to service instances.
export const getProducts = (url: string, ck: string, cs: string, limit?: number | string) =>
  createProductService(url, ck, cs).getProducts(limit);
export const getProductById = (url: string, ck: string, cs: string, id: number) =>
  createProductService(url, ck, cs).getProductById(id);
export const getProductBySku = (url: string, ck: string, cs: string, sku: string) =>
  createProductService(url, ck, cs).getProductBySku(sku);
export const getProductByName = (url: string, ck: string, cs: string, name: string, limit?: number | string) =>
  createProductService(url, ck, cs).getProductByName(name, limit);
export const getProductsByCategory = (url: string, ck: string, cs: string, category?: number | string, limit?: number | string) =>
  createProductService(url, ck, cs).getProductsByCategory(category, limit);
export const createProduct = (url: string, ck: string, cs: string, data: Payload) =>
  createProductService(url, ck, cs).createProduct(data);
export const updateProduct = (url: string, ck: string, cs: string, id: number | string, payload: Payload) =>
  createProductService(url, ck, cs).updateProduct(id, payload);
export const updateProductBySku = (url: string, ck: string, cs: string, sku: string, payload: Payload) =>
  createProductService(url, ck, cs).updateProductBySku(sku, payload);
