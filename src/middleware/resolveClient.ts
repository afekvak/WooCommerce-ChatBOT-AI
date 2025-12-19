// src/middleware/resolveClient.ts
import type { Request, Response, NextFunction } from "express";
import type { Pool } from "pg";
import type { ClientContext } from "../mcp/types";


export interface ClientRequest extends Request {
  clientContext?: ClientContext | null;
  sessionId?: string;
}

export function createClientResolver(db: Pool) {
  // direct helper if you ever want to call it by hand
  async function resolveClientByKey(clientKey: string): Promise<ClientContext | null> {
    const sql = `
      SELECT id, client_key, woo_url, woo_ck, woo_cs , full_name
      FROM users
      WHERE client_key = $1
      LIMIT 1
    `;

    const { rows } = await db.query(sql, [clientKey]);
    if (rows.length === 0) return null;

    const row = rows[0];

    return {
      id: row.id,
      clientKey: row.client_key,
      wooUrl: row.woo_url,
      wooCk: row.woo_ck,
      wooCs: row.woo_cs,
      name: row.full_name
    };
  }

  // Express middleware used on /chat
  async function clientMiddleware(req: ClientRequest, _res: Response, next: NextFunction) {
    try {
      // read from header first, then from body as fallback
      const fromHeader = req.header("x-mcp-client-key") || req.header("X-MCP-Client-Key");
      const fromBody =
        (req.body && (req.body.clientKey as string | undefined)) || undefined;

      const clientKey = (fromHeader || fromBody || "").trim();

      if (!clientKey) {
        // anonymous session (no client linked)
        req.clientContext = null;
        req.sessionId = `anon:${req.ip || "unknown"}`;
        return next();
      }

      const client = await resolveClientByKey(clientKey);

      if (!client) {
        // unknown client, but do not crash the chat
        req.clientContext = null;
        req.sessionId = `unknown:${clientKey}`;
        return next();
      }

      // attach context + per client session id
      req.clientContext = client;
      req.sessionId = `client:${client.id}`;

      return next();
    } catch (err) {
      console.error("resolveClient middleware error:", err);
      req.clientContext = null;
      req.sessionId = `error:${req.ip || "unknown"}`;
      return next();
    }
  }

  return {
    resolveClientByKey,
    clientMiddleware,
  };
}
