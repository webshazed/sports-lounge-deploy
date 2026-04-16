import "dotenv/config";
import { getPool } from "./api/_lib/db.js";

async function run() {
  const p = getPool();
  try {
    const res = await p.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name='connections';
    `);
    console.log("columns:", res.rows);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
