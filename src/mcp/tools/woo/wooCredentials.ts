// src/mcp/woo/wooCredentials.ts
import type { ToolCtx } from "../../types";

interface CredArgs {
  url?: string;
  ck?: string;
  cs?: string;
}

export function resolveWooCredentials(
  args: CredArgs,
  ctx?: ToolCtx
) {
  const client = ctx?.client;

  const url =
    args.url ??
    client?.wooUrl ??
    process.env.WOO_URL;

  const ck =
    args.ck ??
    client?.wooCk ??
    process.env.WOO_CK;

  const cs =
    args.cs ??
    client?.wooCs ??
    process.env.WOO_CS;

  if (!url || !ck || !cs) {
    throw new Error(
      "WooCommerce credentials are missing for this client. Make sure the store URL and API keys are configured."
    );
  }

  return { url, ck, cs };
}
