import pg from "pg";
const cs = "postgresql://postgres.iiewromktjaehcvfegsz:Americanhairline%40123@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres";
const c = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await c.connect();
console.log("latest uploads:", (await c.query("select file_name,type,file_url is not null as stored, length(extracted_text) as tlen from uploads order by created_at desc limit 3")).rows);
console.log("latest tasks:", (await c.query("select name,frequency from tasks order by created_at desc limit 5")).rows);
await c.end();
