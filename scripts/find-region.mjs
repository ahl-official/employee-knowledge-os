import pg from "pg";
const ref = "iiewromktjaehcvfegsz";
const pw = "Americanhairline@123";
const regions = ["us-east-1","us-east-2","us-west-1","us-west-2","ap-south-1","ap-southeast-1","ap-southeast-2","ap-northeast-1","ap-northeast-2","ca-central-1","eu-west-1","eu-west-2","eu-west-3","eu-central-1","eu-central-2","eu-north-1","sa-east-1"];
for (const region of regions) {
  for (const pre of ["aws-0","aws-1"]) {
    const host = `${pre}-${region}.pooler.supabase.com`;
    const c = new pg.Client({ host, port: 5432, user: `postgres.${ref}`, password: pw, database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 6000 });
    try { await c.connect(); await c.query("select 1"); console.log("MATCH", host); await c.end(); process.exit(0); }
    catch (e) { const m=e.message.slice(0,30); if(!m.includes("Tenant")) console.log("?", host, m); try{await c.end();}catch{} }
  }
}
console.log("NONE_MATCHED");
