import "dotenv/config";
import { getPool } from "./api/_lib/db.js";

async function run() {
  const p = getPool();
  try {
    const res = await p.query("SELECT * FROM posts ORDER BY created_at DESC LIMIT 5;");
    console.log("posts:", res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
