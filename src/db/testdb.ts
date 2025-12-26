import { getDb } from "./pool";

async function main() {
  const db = getDb();

  try {
    const result = await db.query("select client_key, server_prefs, server_settings, ui_settings" +
"from mcp_client_config" +
"where client_key = 'TEST123';");
    console.log("Users sample:", result.rows);
  } catch (err) {
    console.error("Users select failed:", err);
  } finally {
    await db.end();
  }
}

main().catch((err) => console.error("Fatal error in main:", err));
