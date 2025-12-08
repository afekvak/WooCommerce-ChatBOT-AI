// src/controllers/wooGetController.ts
import { createWooClient } from "./wooClient";

export async function createProduct(
  url: string,
  ck: string,
  cs: string,
  data: any
) {
  const api = createWooClient(url, ck, cs);

  try {
    const res = await api.post("products", data);
    return res.data;
  } catch (err: any) {
    const status = err.response?.status;
    const wooData = err.response?.data;

    // Log full payload + error to server console for deep debug
    console.error("Woo createProduct error status:", status);
    console.error("Payload sent:", JSON.stringify(data, null, 2));
    console.error("Woo error body:", JSON.stringify(wooData, null, 2));

    // Build a detailed message for the bot
    const details =
      wooData?.message
        || wooData?.data?.params
        || JSON.stringify(wooData, null, 2)
        || err.message;

    throw new Error(
      `WooCommerce createProduct failed (status ${status ?? "?"}): ${details}`
    );
  }
}
