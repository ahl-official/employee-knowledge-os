import pg from "pg";
const cs = "postgresql://postgres.iiewromktjaehcvfegsz:Americanhairline%40123@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres";
const ids = [
  '3b1b3349-f582-4e61-a358-cc0232cf74ec',
  '5e516e6d-24ca-46d7-82d7-e3a772c8c8e9',
  '94e6dc43-1690-4e9f-9cee-8793cef3bec8',
  '4d43bdf1-9c85-4030-a56a-04eeaca3294a',
  '006ac6b2-d09a-43bb-812e-d3dc0ff1979c',
];
const c = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query("delete from employees where id = any($1::uuid[]) returning full_name", [ids]);
console.log("deleted:", r.rows.map(x=>x.full_name));
console.log("remaining:", (await c.query("select count(*) from employees")).rows[0].count);
await c.end();
