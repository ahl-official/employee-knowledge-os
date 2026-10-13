import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

// 1. Load .env.local
const envPath = path.resolve(process.cwd(), ".env.local");
const env = fs.readFileSync(envPath, "utf-8");
const get = (k) => {
  const m = env.match(new RegExp(k + "=(.*)"));
  return m ? m[1].trim() : "";
};

const supabaseUrl = get("NEXT_PUBLIC_SUPABASE_URL");
const supabaseKey = get("SUPABASE_SERVICE_ROLE_KEY");
const gDriveFolder = get("GDRIVE_FOLDER_ID");
const gDriveKey = get("GOOGLE_SERVICE_ACCOUNT_JSON");

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing Supabase credentials in .env.local");
  process.exit(1);
}

if (!gDriveFolder || !gDriveKey) {
  console.error("❌ Missing Google Drive credentials in .env.local");
  process.exit(1);
}

const db = createClient(supabaseUrl, supabaseKey);

// Setup Google Drive Client
const credentials = JSON.parse(gDriveKey);
const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ["https://www.googleapis.com/auth/drive"],
});
const drive = google.drive({ version: "v3", auth });

function cleanText(text) {
  if (!text) return "";
  let s = text.trim();
  s = s.replace(/^(my reporting manager is|my manager is|reporting manager is|manager is|reports to)\s+/i, "");
  s = s.replace(/^(i have|my experience is|experience is)\s+/i, "");
  s = s.replace(/^(my main responsibility is|my responsibility is|main responsibility is|responsibility is)\s+/i, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatCategory(cat) {
  if (!cat) return "General";
  return cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, " ");
}

/**
 * Builds a publication-grade Standard Operating Procedure (SOP) & Knowledge Base Markdown file
 */
function generateEmployeeMarkdown(employee, tasks, facts, uploads) {
  const safeName = cleanText(employee.full_name) || "Employee";
  const now = new Date().toISOString().split("T")[0];

  let md = `# Standard Operating Procedure (SOP) & Knowledge Base\n\n`;
  md += `**Employee:** ${safeName}  \n`;
  md += `**Document Version:** 1.0 (Live Synthesis)  \n`;
  md += `**Last Updated:** ${now}  \n`;
  md += `**Knowledge Capture Progress:** ${employee.overall_progress}%  \n`;
  md += `**Status:** ${cleanText(employee.status || "in_progress")}  \n\n`;
  md += `---\n\n`;

  // Section 1: Personnel Profile
  md += `## 1. Personnel Profile\n\n`;
  md += `| Field | Details |\n`;
  md += `| :--- | :--- |\n`;
  md += `| **Full Name** | ${safeName} |\n`;
  md += `| **Department** | ${cleanText(employee.department || "General / Operations")} |\n`;
  md += `| **Role / Designation** | ${cleanText(employee.designation || "Not specified")} |\n`;
  md += `| **Reporting Manager** | ${cleanText(employee.reporting_manager || "Not specified")} |\n`;
  md += `| **Experience & Tenure** | ${cleanText(employee.experience || "Not specified")} |\n`;
  md += `| **Primary Responsibility** | ${cleanText(employee.main_responsibility || "Not specified")} |\n\n`;

  // Section 2: Executive Overview
  md += `## 2. Role Overview & Operational Scope\n\n`;
  if (employee.main_responsibility) {
    md += `${employee.main_responsibility}\n\n`;
  } else {
    md += `Comprehensive operating guidelines and procedural workflows for ${safeName}.\n\n`;
  }

  // Section 3: Tasks Overview Table
  md += `## 3. Tasks & Responsibilities Directory\n\n`;
  if (!tasks || tasks.length === 0) {
    md += `*No discrete tasks recorded yet.*\n\n`;
  } else {
    md += `| # | Task Name | Cadence / Frequency | Priority | Status |\n`;
    md += `| :-: | :--- | :--- | :--- | :--- |\n`;
    tasks.forEach((t, i) => {
      md += `| ${i + 1} | **${cleanText(t.name)}** | ${cleanText(t.frequency || "Ad-hoc / As required")} | ${cleanText(t.priority || "Medium")} | \`${cleanText(t.status)}\` |\n`;
    });
    md += `\n---\n\n`;

    // Section 4: Detailed Task Workflows
    md += `## 4. Comprehensive Task Workflows\n\n`;
    tasks.forEach((t, idx) => {
      const taskFacts = facts.filter((f) => f.task_id === t.id);

      md += `### 4.${idx + 1} Task: ${cleanText(t.name)}\n\n`;
      md += `- **Cadence / Frequency:** ${cleanText(t.frequency || "Ad-hoc")}\n`;
      md += `- **Priority Level:** ${cleanText(t.priority || "Medium")}\n`;
      md += `- **Operational Status:** \`${cleanText(t.status)}\`\n`;

      if (t.coverage && Object.keys(t.coverage).length > 0) {
        const covKeys = Object.entries(t.coverage)
          .filter(([_, score]) => score > 0)
          .map(([k, score]) => `${formatCategory(k)}: ${score}%`);
        if (covKeys.length > 0) {
          md += `- **Knowledge Coverage:** ${covKeys.join(" • ")}\n`;
        }
      }
      md += `\n`;

      if (taskFacts.length === 0) {
        md += `> *Detailed procedural steps for this task are pending or in progress.*\n\n`;
      } else {
        const byCat = {};
        taskFacts.forEach((f) => {
          const c = f.category || "misc";
          if (!byCat[c]) byCat[c] = [];
          byCat[c].push(cleanText(f.fact_text));
        });

        // Structured dimensions order
        const dimOrder = [
          "work_source",
          "inputs",
          "steps",
          "tools",
          "quality_check",
          "approval",
          "decisions",
          "exceptions",
          "failure_handling",
          "output",
          "evidence",
          "research",
          "misc",
        ];

        for (const cat of dimOrder) {
          if (byCat[cat] && byCat[cat].length > 0) {
            md += `#### ${formatCategory(cat)}\n`;
            byCat[cat].forEach((text) => {
              md += `- ${text}\n`;
            });
            md += `\n`;
            delete byCat[cat];
          }
        }

        // Any leftover categories
        for (const [cat, items] of Object.entries(byCat)) {
          if (items.length > 0) {
            md += `#### ${formatCategory(cat)}\n`;
            items.forEach((text) => {
              md += `- ${text}\n`;
            });
            md += `\n`;
          }
        }
      }
      md += `---\n\n`;
    });
  }

  // Section 5: General Knowledge & Cross-Cutting Facts
  const generalFacts = facts.filter((f) => !f.task_id);
  if (generalFacts.length > 0) {
    md += `## 5. Organization Knowledge & Cross-Department Collaboration\n\n`;
    const genByCat = {};
    generalFacts.forEach((f) => {
      const c = f.category || "general";
      if (!genByCat[c]) genByCat[c] = [];
      genByCat[c].push(cleanText(f.fact_text));
    });

    for (const [cat, items] of Object.entries(genByCat)) {
      md += `### ${formatCategory(cat)}\n`;
      items.forEach((text) => {
        md += `- ${text}\n`;
      });
      md += `\n`;
    }
    md += `---\n\n`;
  }

  // Section 6: Uploaded Documents & Evidence Files
  if (uploads && uploads.length > 0) {
    md += `## 6. Document & Evidence Artifacts\n\n`;
    md += `| File Name | Type | Description | Created |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    uploads.forEach((u) => {
      md += `| **${cleanText(u.file_name || "Attachment")}** | \`${u.type || "file"}\` | ${cleanText(u.description || "Uploaded evidence")} | ${u.created_at ? u.created_at.split("T")[0] : "—"} |\n`;
    });
    md += `\n---\n\n`;
  }

  md += `\n*Generated by Employee Knowledge OS — Company Internal SOP Repository*\n`;
  return md;
}

/**
 * Uploads or updates a file in the Google Drive folder.
 */
async function uploadToGoogleDrive(fileName, content, folderId) {
  // Check if file already exists in target folder
  const listRes = await drive.files.list({
    q: `'${folderId}' in parents and name = '${fileName}' and trashed = false`,
    fields: "files(id, name, webViewLink)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const existingFile = listRes.data.files?.[0];

  const stream = new Readable();
  stream.push(content);
  stream.push(null);

  if (existingFile) {
    console.log(`🔄 Updating existing file in Google Drive: "${fileName}" (ID: ${existingFile.id})...`);
    const updateRes = await drive.files.update({
      fileId: existingFile.id,
      media: {
        mimeType: "text/markdown",
        body: stream,
      },
      fields: "id, name, webViewLink",
      supportsAllDrives: true,
    });
    return { id: updateRes.data.id, name: fileName, url: updateRes.data.webViewLink, updated: true };
  } else {
    console.log(`📤 Uploading new file to Google Drive: "${fileName}"...`);
    const createRes = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId],
      },
      media: {
        mimeType: "text/markdown",
        body: stream,
      },
      fields: "id, name, webViewLink",
      supportsAllDrives: true,
    });
    return { id: createRes.data.id, name: fileName, url: createRes.data.webViewLink, updated: false };
  }
}

async function run() {
  console.log("🚀 Starting Employee Knowledge Export & Google Drive Sync...");
  console.log(`Target Google Drive Folder ID: ${gDriveFolder}\n`);

  // 1. Fetch all active employees
  const { data: employees, error: empErr } = await db
    .from("employees")
    .select("*")
    .order("created_at", { ascending: true });

  if (empErr || !employees) {
    console.error("❌ Error fetching employees:", empErr);
    process.exit(1);
  }

  console.log(`Found ${employees.length} employees in Supabase:`);
  employees.forEach((e) => console.log(` - ${e.full_name} (${e.department || "No dept"}, ${e.overall_progress}%)`));

  // Local output directory
  const localOutputDir = path.resolve(process.cwd(), "exports", "sops");
  if (!fs.existsSync(localOutputDir)) {
    fs.mkdirSync(localOutputDir, { recursive: true });
  }

  const results = [];

  for (const emp of employees) {
    console.log(`\n======================================================`);
    console.log(`📄 Processing Employee: ${emp.full_name}...`);

    // Fetch employee data
    const [tasksRes, factsRes, uploadsRes] = await Promise.all([
      db.from("tasks").select("*").eq("employee_id", emp.id).order("created_at", { ascending: true }),
      db.from("facts").select("*").eq("employee_id", emp.id).order("created_at", { ascending: true }),
      db.from("uploads").select("*").eq("employee_id", emp.id).order("created_at", { ascending: true }),
    ]);

    const tasks = tasksRes.data ?? [];
    const facts = factsRes.data ?? [];
    const uploads = uploadsRes.data ?? [];

    console.log(`   Captured Data: ${tasks.length} tasks, ${facts.length} facts, ${uploads.length} uploads.`);

    // Generate Markdown
    const markdownContent = generateEmployeeMarkdown(emp, tasks, facts, uploads);

    // Save local copy
    const safeSlug = (emp.full_name || "employee").replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const fileName = `${safeSlug}_sop.md`;
    const localFilePath = path.join(localOutputDir, fileName);
    fs.writeFileSync(localFilePath, markdownContent, "utf-8");
    console.log(`💾 Saved local copy: ${localFilePath} (${markdownContent.length} chars)`);

    // Attempt upload to Google Drive
    let driveUrl = null;
    let driveId = null;
    try {
      const driveResult = await uploadToGoogleDrive(fileName, markdownContent, gDriveFolder);
      console.log(`✅ Uploaded to Google Drive: ${driveResult.name}`);
      console.log(`🔗 Link: ${driveResult.url}`);
      driveUrl = driveResult.url;
      driveId = driveResult.id;
    } catch (gErr) {
      console.warn(`⚠️ Google Drive upload error for ${fileName}:`, gErr.message);
      if (gErr.message?.includes("storage quota")) {
        console.warn(`ℹ️ Notice: Target folder is in 'My Drive' rather than a 'Shared Drive'. Service accounts have 0 MB quota in personal drives.`);
      }
    }

    results.push({
      employee: emp.full_name,
      department: emp.department || "N/A",
      role: emp.designation || "N/A",
      progress: emp.overall_progress,
      tasksCount: tasks.length,
      factsCount: facts.length,
      fileName,
      localFilePath,
      driveUrl,
      driveId,
    });
  }

  // Also create a master Index README.md
  console.log(`\n======================================================`);
  console.log(`📚 Generating Master Employee Directory Index...`);
  let indexMd = `# Knowledge OS — Employee SOPs & Second Brain Directory\n\n`;
  indexMd += `**Target Google Drive Folder:** Knowledge-os-data (${gDriveFolder})  \n`;
  indexMd += `**Last Synced:** ${new Date().toISOString()}  \n\n`;
  indexMd += `| Employee | Department | Role | Progress | Tasks | Facts | Local SOP File |\n`;
  indexMd += `| :--- | :--- | :--- | :-: | :-: | :-: | :--- |\n`;
  for (const r of results) {
    indexMd += `| **${r.employee}** | ${r.department} | ${r.role} | ${r.progress}% | ${r.tasksCount} | ${r.factsCount} | \`${r.fileName}\` |\n`;
  }
  indexMd += `\n---\n*Generated from Supabase database via Employee Knowledge OS.*`;

  const indexLocalPath = path.join(localOutputDir, "00_EMPLOYEES_INDEX.md");
  fs.writeFileSync(indexLocalPath, indexMd, "utf-8");
  console.log(`💾 Master Index saved locally: ${indexLocalPath}`);

  try {
    const indexDriveRes = await uploadToGoogleDrive("00_EMPLOYEES_INDEX.md", indexMd, gDriveFolder);
    console.log(`✅ Master Index uploaded to Google Drive: ${indexDriveRes.url}`);
  } catch (idxErr) {
    console.warn(`⚠️ Could not upload Master Index to Drive:`, idxErr.message);
  }

  console.log(`\n🎉 Generated all ${results.length} employee SOP Markdown files!`);
  results.forEach(r => console.log(` - ${r.employee}: ${r.fileName} (${r.driveUrl || "Saved locally in exports/sops/"})`));
}

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
