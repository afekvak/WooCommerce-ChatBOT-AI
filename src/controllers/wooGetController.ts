// src/controllers/wooGetController.ts
import { createWooClient } from "./wooClient";

// --------------------------
// GET PRODUCTS
// --------------------------
export async function getProducts(
  url: string,
  ck: string,
  cs: string,
  limit?: number | string
) {
  const api = createWooClient(url, ck, cs);

  // limit
  let perPage = 20;

  if (typeof limit === "number" && limit > 0) {
    perPage = limit;
  } else if (typeof limit === "string") {
    const parsed = parseInt(limit, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      perPage = parsed;
    }
  }

  try {
    const res = await api.get("products", { per_page: perPage });
    return res.data;
  } catch (err: any) {
    throw new Error(`WooCommerce getProducts failed: ${err.message}`);
  }
}


// --------------------------
// GET PRODUCT BY ID
// --------------------------
export async function getProductById(url: string, ck: string, cs: string, id: number) {
  const api = createWooClient(url, ck, cs);

  try {
    const res = await api.get(`products/${id}`);
    return res.data;
  } catch (err: any) {
    throw new Error(`WooCommerce getProductById failed: ${err.message}`);
  }
}


// --------------------------
// GET PRODUCT BY SKU
// --------------------------
export async function getProductBySku(url: string, ck: string, cs: string, sku: string) {
  const api = createWooClient(url, ck, cs);

  try {
    const res = await api.get("products", {
      sku,
      status: "any"  // <---- VERY IMPORTANT
    });
    return res.data;
  } catch (err: any) {
    throw new Error(`WooCommerce getProductsBySku failed: ${err.message}`);
  }
}

// --------------------------
// GET PRODUCTS BY NAME
// --------------------------
// Note returns an array of products that match the search term in the name
export async function getProductByName(
  url: string,
  ck: string,
  cs: string,
  name: string,
  limit?: number | string           // <- accept number or string or undefined
) {
  const api = createWooClient(url, ck, cs);

  // normalize limit to a positive number, default 20
  let perPage = 20;

  if (typeof limit === "number" && limit > 0) {
    perPage = limit;
  } else if (typeof limit === "string") {
    const parsed = parseInt(limit, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      perPage = parsed;
    }
  }

  try {
    const res = await api.get("products", {
      search: name,      // WooCommerce searches by title, etc.
      per_page: perPage, // <- normalized number
      status: "any"
    });

    return res.data;     // array of matching products
  } catch (err: any) {
    throw new Error(`WooCommerce getProductByName failed: ${err.message}`);
  }
}


// --------------------------
// GET PRODUCTS BY CATEGORY
// --------------------------

export async function getProductsByCategory(
  url: string,
  ck: string,
  cs: string,
  category?: number | string,        // <- now optional
  limit?: number | string            // <- union and optional
) {
  const api = createWooClient(url, ck, cs);

  // normalize limit
  let perPage = 20;
  if (typeof limit === "number" && limit > 0) {
    perPage = limit;
  } else if (typeof limit === "string") {
    const parsed = parseInt(limit, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      perPage = parsed;
    }
  }

  try {
    let categoryId: number | undefined;

    if (typeof category === "number") {
      // direct category ID
      categoryId = category;
    } else if (typeof category === "string") {
      // slug → get real category ID
      const catRes = await api.get("products/categories", {
        per_page: 100,
        slug: category
      });

      if (!Array.isArray(catRes.data) || catRes.data.length === 0) {
        throw new Error(`Category slug '${category}' not found`);
      }

      categoryId = catRes.data[0].id;
    }

    if (!categoryId) {
      throw new Error("Missing category id or slug");
    }

    const res = await api.get("products", {
      per_page: perPage,
      category: categoryId
    });

    return res.data;
  } catch (err: any) {
    throw new Error(
      `WooCommerce getProductsByCategory failed: ${err.message}`
    );
  }
}

