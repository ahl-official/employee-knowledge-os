import pg from "pg";
const cs = "postgresql://postgres.iiewromktjaehcvfegsz:Americanhairline%40123@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres";
const c = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await c.connect();
for (const t of ["messages","tasks","facts","branches"]) {
  const r = await c.query(`select count(*) from ${t}`);
  console.log(t, "=", r.rows[0].count);
}
console.log("--- tasks ---");
console.log((await c.query("select name,status from tasks")).rows);
console.log("--- open branches ---");
console.log((await c.query("select topic,priority from branches where status='open'")).rows);
console.log("--- sample facts ---");
console.log((await c.query("select category,fact_text from facts limit 6")).rows);
await c.end();
