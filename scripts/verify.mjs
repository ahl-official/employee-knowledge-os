import pg from "pg";
const cs = "postgresql://postgres.iiewromktjaehcvfegsz:Americanhairline%40123@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres";
const c = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await c.connect();
const t = await c.query("select table_name from information_schema.tables where table_schema='public' order by 1");
console.log("TABLES:", t.rows.map(r=>r.table_name).join(", "));
const b = await c.query("select id from storage.buckets where id='uploads'");
console.log("BUCKET uploads:", b.rows.length? "exists":"MISSING");
await c.end();
