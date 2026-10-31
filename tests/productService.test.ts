import assert from "node:assert/strict";
import test from "node:test";
import { ProductService, type ProductApi } from "../src/services/productService";

function fixture(responses: any[] = []) {
  const calls: Array<{ method: string; path: string; data: unknown }> = [];
  const request = async (method: string, path: string, data: unknown) => {
    calls.push({ method, path, data });
    const response = responses.shift();
    if (response instanceof Error) throw response;
    return { data: response };
  };
  const api: ProductApi = {
    get: (path, params) => request("GET", path, params),
    post: (path, data) => request("POST", path, data),
    put: (path, data) => request("PUT", path, data)
  };
  return { service: new ProductService(api), calls };
}

test("reads retain filters, defaults, and WooCommerce page limits", async () => {
  const { service, calls } = fixture([[], [], []]);
  await service.getProducts();
  await service.getProductByName("shirt", "200");
  await service.listProducts({ page: 2, per_page: 50, category: 9 });
  assert.deepEqual(calls.map(call => call.data), [
    { per_page: 20 },
    { search: "shirt", per_page: 100, status: "any" },
    { page: 2, per_page: 50, category: 9 }
  ]);
});

test("SKU updates resolve a product before writing to its numeric ID", async () => {
  const { service, calls } = fixture([[{ id: 42 }], { id: 42, regular_price: "50" }]);
  const result = await service.updateProductBySku("shirt-1", { regular_price: "50" });
  assert.equal(result.id, 42);
  assert.deepEqual(calls, [
    { method: "GET", path: "products", data: { sku: "shirt-1", status: "any" } },
    { method: "PUT", path: "products/42", data: { regular_price: "50" } }
  ]);
});

test("missing SKUs and invalid IDs never write to WooCommerce", async () => {
  const { service, calls } = fixture([[]]);
  await assert.rejects(service.updateProductBySku("missing", {}), /No product found/);
  for (const id of ["12junk", "", 0, -1, 1.5]) {
    assert.throws(() => service.updateProduct(id, {}), /Invalid product ID/);
  }
  assert.equal(calls.length, 1);
  assert.throws(() => service.updateProduct(12, []), /Missing update payload/);
});

test("category searches resolve slugs and taxonomy lookups support creation", async () => {
  const { service, calls } = fixture([[{ id: 9 }], [{ id: 42 }], [{ id: 5 }]]);
  assert.deepEqual(await service.getProductsByCategory("shirts", 10), [{ id: 42 }]);
  assert.deepEqual(await service.findTerms("tags", { search: "summer", per_page: 50 }), [{ id: 5 }]);
  assert.deepEqual(calls.map(call => [call.path, call.data]), [
    ["products/categories", { per_page: 100, slug: "shirts" }],
    ["products", { per_page: 10, category: 9 }],
    ["products/tags", { search: "summer", per_page: 50 }]
  ]);
});

test("create and batch operations preserve payloads and individual item failures", async () => {
  const batch = { update: [{ id: 42 }, { id: 0, error: { message: "Invalid product" } }] };
  const { service, calls } = fixture([{ id: 42 }, batch]);
  await service.createProduct({ name: "Shirt", status: "draft" });
  const updates = [{ id: 42, regular_price: "50" }, { id: 99, regular_price: "60" }];
  assert.deepEqual(await service.updateProductsBatch(updates), batch);
  assert.deepEqual(calls[1], { method: "PUT", path: "products/batch", data: { update: updates } });
  assert.throws(() => service.updateProductsBatch(Array.from({ length: 101 }, () => ({ id: 42 }))), /at most 100/);
});

test("API failures retain useful operation context", async () => {
  const { service } = fixture([Object.assign(new Error("HTTP failure"), {
    response: { data: { message: "Product SKU already exists" } }
  })]);
  await assert.rejects(service.createProduct({ name: "Shirt" }), /createProduct failed: Product SKU already exists/);
});
