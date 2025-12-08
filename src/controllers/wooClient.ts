// src/controllers/wooCRUD.ts
import WooCommerceRestApi from "@woocommerce/woocommerce-rest-api";

export function createWooClient(url: string, ck: string, cs: string) {
  return new WooCommerceRestApi({
    url,
    consumerKey: ck,
    consumerSecret: cs,
    version: "wc/v3",
    queryStringAuth: true, // ensures CK/CS works on all servers
  });
}

