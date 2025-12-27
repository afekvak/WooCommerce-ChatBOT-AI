// src/middleware/resolveClient.ts
import type { Request, Response, NextFunction } from "express";
import type { Pool } from "pg";
import type { ClientContext } from "../mcp/types";
import crypto from "node:crypto";

export interface ClientRequest extends Request {
  clientContext?: ClientContext | null;
  sessionId?: string;
}

function hashClientKey(plain: string): string {
  return crypto.createHash("sha256").update(plain, "utf8").digest("hex");
}

export function createClientResolver(db: Pool) {
  async function resolveClientByKey(clientKey: string): Promise<ClientContext | null> {
    const keyHash = hashClientKey(clientKey);

    const sql = `
      SELECT id, woo_url, woo_ck, woo_cs, full_name
      FROM users
      WHERE client_key_hash = $1
      LIMIT 1
    `;

    const { rows } = await db.query(sql, [keyHash]);
    if (rows.length === 0) return null;

    const row = rows[0];

    return {
      id: row.id,
      clientKey: clientKey, // keep plaintext in memory only, not from DB
      wooUrl: row.woo_url,
      wooCk: row.woo_ck,
      wooCs: row.woo_cs,
      name: row.full_name
    };
  }

  async function clientMiddleware(req: ClientRequest, _res: Response, next: NextFunction) {
    try {
      const fromHeader = req.header("x-mcp-client-key") || req.header("X-MCP-Client-Key");
      const fromBody = (req.body && (req.body.clientKey as string | undefined)) || undefined;

      const clientKey = (fromHeader || fromBody || "").trim();

      if (!clientKey) {
        req.clientContext = null;
        req.sessionId = `anon:${req.ip || "unknown"}`;
        return next();
      }

      const client = await resolveClientByKey(clientKey);

      if (!client) {
        req.clientContext = null;
        req.sessionId = `unknown:${req.ip || "unknown"}`;
        return next();
      }

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

  return { resolveClientByKey, clientMiddleware };
}
