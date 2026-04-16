import "dotenv/config";
import { getPool } from "./api/_lib/db.js";

async function run() {
  const p = getPool();
  try {
    await p.query("DROP TABLE IF EXISTS connections;");
    console.log("Dropped connections table successfully.");
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
