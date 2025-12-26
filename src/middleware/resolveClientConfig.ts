import type { Response, NextFunction } from "express";
import type { Pool } from "pg";
import type { ClientRequest } from "./resolveClient.js";
import type { ClientConfig } from "../clientConfig/types.js";
import { DEFAULT_PREFS, DEFAULT_SETTINGS, DEFAULT_UI } from "../clientConfig/defaults.js";

export interface ClientConfigRequest extends ClientRequest {
  clientConfig?: ClientConfig | null;
}

function asObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  return {};
}

function normalizeTheme(value: unknown): "light" | "dark" {
  if (value === "light") return "light";
  if (value === "dark") return "dark";
  return DEFAULT_UI.theme;
}

function pickBooleanMap(raw: unknown): Record<string, boolean> {
  const obj = asObject(raw);
  const out: Record<string, boolean> = {};

  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "boolean") out[k] = v;
  }

  return out;
}

function mergeConfig(
  clientKey: string,
  prefsRaw: unknown,
  settingsRaw: unknown,
  uiRaw: unknown
): ClientConfig {
  const prefsObj = asObject(prefsRaw);
  const settingsObj = asObject(settingsRaw);
  const uiObj = asObject(uiRaw);

  const confirmations = pickBooleanMap((settingsObj as any).confirmations);

  return {
    clientKey,
    prefs: {
      allowRealName:
        typeof (prefsObj as any).allowRealName === "boolean"
          ? (prefsObj as any).allowRealName
          : DEFAULT_PREFS.allowRealName
    },
    settings: {
      confirmations: Object.keys(confirmations).length ? confirmations : DEFAULT_SETTINGS.confirmations
    },
    ui: {
      theme: normalizeTheme((uiObj as any).theme),
      scale:
        typeof (uiObj as any).scale === "number" &&
        Number.isFinite((uiObj as any).scale) &&
        (uiObj as any).scale > 0
          ? (uiObj as any).scale
          : DEFAULT_UI.scale,
      defaultWide:
        typeof (uiObj as any).defaultWide === "boolean"
          ? (uiObj as any).defaultWide
          : DEFAULT_UI.defaultWide
    }
  };
}

export function createClientConfigResolver(db: Pool) {
  async function resolveByKey(clientKey: string): Promise<ClientConfig> {
    const key = String(clientKey || "").trim();

    if (!key) {
      return { clientKey: "", prefs: DEFAULT_PREFS, settings: DEFAULT_SETTINGS, ui: DEFAULT_UI };
    }

    const result = await db.query(
      `
      select client_key, server_prefs, server_settings, ui_settings
      from mcp_client_config
      where client_key = $1
      limit 1
      `,
      [key]
    );

    if (result.rows.length === 0) {
      await db.query(
        `
        insert into mcp_client_config (client_key, server_prefs, server_settings, ui_settings)
        values ($1, $2::jsonb, $3::jsonb, $4::jsonb)
        on conflict (client_key) do nothing
        `,
        [key, JSON.stringify(DEFAULT_PREFS), JSON.stringify(DEFAULT_SETTINGS), JSON.stringify(DEFAULT_UI)]
      );

      return { clientKey: key, prefs: DEFAULT_PREFS, settings: DEFAULT_SETTINGS, ui: DEFAULT_UI };
    }

    const row = result.rows[0];
    return mergeConfig(key, row.server_prefs, row.server_settings, row.ui_settings);
  }

  async function clientConfigMiddleware(req: ClientConfigRequest, _res: Response, next: NextFunction) {
    try {
      const clientKey = String(req.clientContext?.clientKey || "").trim();

      if (!clientKey) {
        req.clientConfig = null;
        return next();
      }

      req.clientConfig = await resolveByKey(clientKey);
      return next();
    } catch (err) {
      console.error("resolveClientConfig middleware error:", err);
      req.clientConfig = null;
      return next();
    }
  }

  return { resolveByKey, clientConfigMiddleware };
}
