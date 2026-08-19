import pg from "pg";
const cs = "postgresql://postgres.iiewromktjaehcvfegsz:Americanhairline%40123@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres";
const c = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await c.connect();
console.log((await c.query("select id, full_name, department from employees order by created_at")).rows);
await c.end();
