const BASE = "http://localhost:3001";
const admin = { "Content-Type": "application/json", "x-admin-passphrase": "1234" };
const emp = await (await fetch(`${BASE}/api/admin/employees`, { method:"POST", headers:admin, body:JSON.stringify({full_name:"Node Upload Test",department:"Editing"})})).json();
const token = emp.employee.access_token;
await fetch(`${BASE}/api/interview/session?token=${token}`);
for (const a of ["Sam","Editing","Editor","Boss","1 year","I edit videos"]) {
  await fetch(`${BASE}/api/interview/answer`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({token, answer:a})});
}
const csv = "Task,Frequency,Tool\nEdit client reels,Daily,Premiere Pro\nMake thumbnails,Daily,Photoshop\nUpload to YouTube,Weekly,Browser\n";
const fd = new FormData();
fd.append("token", token);
fd.append("file", new File([csv], "tasklist.csv", { type: "text/csv" }));
const res = await fetch(`${BASE}/api/upload`, { method:"POST", body: fd });
console.log("status", res.status);
console.log(await res.text());
