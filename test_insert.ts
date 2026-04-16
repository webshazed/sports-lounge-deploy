import "dotenv/config";
import { getPool } from "./api/_lib/db.js";

async function run() {
  const p = getPool();
  try {
    const postContent = `📅 **I just created a new Event:** New TEst\n\n📍 London\n⏰ formattedDate\n\nCheck it out and RSVP on the Events tab!`;
    const res = await p.query(
      `insert into posts (user_id, kind, content) values ($1, 'Events', $2) returning *`,
      [4, postContent]
    );
    console.log("Success:", res.rows);
  } catch (e) {
    console.error("Error inserting:", e);
  } finally {
    process.exit(0);
  }
}
run();
