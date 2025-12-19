import { getDb } from "./pool";

async function main() {
  const db = getDb();

  try {
    const result = await db.query("SELECT * FROM users LIMIT 5");
    console.log("Users sample:", result.rows);
  } catch (err) {
    console.error("Users select failed:", err);
  } finally {
    await db.end();
  }
}

main().catch((err) => console.error("Fatal error in main:", err));
