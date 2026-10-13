import { Readable } from "stream";
import fs from "fs";
import path from "path";
import { google } from "googleapis";
import { getServiceClient } from "@/lib/supabase";
import { config } from "@/lib/config";

function cleanText(text: string | null | undefined): string {
  if (!text) return "";
  let s = text.trim();
  s = s.replace(/^(my reporting manager is|my manager is|reporting manager is|manager is|reports to)\s+/i, "");
  s = s.replace(/^(i have|my experience is|experience is)\s+/i, "");
  s = s.replace(/^(my main responsibility is|my responsibility is|main responsibility is|responsibility is)\s+/i, "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatCategory(cat: string | null | undefined): string {
  if (!cat) return "General";
  return cat.charAt(0).toUpperCase() + cat.slice(1).replace(/_/g, " ");
}

/**
 * Generates the full publication-grade Standard Operating Procedure (SOP) Markdown.
 */
export function buildSopMarkdown(
  employee: Record<string, any>,
  tasks: Record<string, any>[],
  facts: Record<string, any>[],
  uploads: Record<string, any>[]
): string {
  const safeName = cleanText(employee.full_name) || "Employee";
  const now = new Date().toISOString().split("T")[0];

  let md = `# Standard Operating Procedure (SOP) & Knowledge Base\n\n`;
  md += `**Employee:** ${safeName}  \n`;
  md += `**Document Version:** 1.0 (Live Auto-Sync)  \n`;
  md += `**Last Updated:** ${now}  \n`;
  md += `**Knowledge Capture Progress:** ${employee.overall_progress || 0}%  \n`;
  md += `**Status:** ${cleanText(employee.status || "in_progress")}  \n\n`;
  md += `---\n\n`;

  // 1. Personnel Profile
  md += `## 1. Personnel Profile\n\n`;
  md += `| Field | Details |\n`;
  md += `| :--- | :--- |\n`;
  md += `| **Full Name** | ${safeName} |\n`;
  md += `| **Department** | ${cleanText(employee.department || "General / Operations")} |\n`;
  md += `| **Role / Designation** | ${cleanText(employee.designation || "Not specified")} |\n`;
  md += `| **Reporting Manager** | ${cleanText(employee.reporting_manager || "Not specified")} |\n`;
  md += `| **Experience & Tenure** | ${cleanText(employee.experience || "Not specified")} |\n`;
  md += `| **Primary Responsibility** | ${cleanText(employee.main_responsibility || "Not specified")} |\n\n`;

  // 2. Role Overview
  md += `## 2. Role Overview & Operational Scope\n\n`;
  if (employee.main_responsibility) {
    md += `${employee.main_responsibility}\n\n`;
  } else {
    md += `Comprehensive operating guidelines and procedural workflows for ${safeName}.\n\n`;
  }

  // 3. Tasks Directory
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

    // 4. Detailed Task Workflows
    md += `## 4. Comprehensive Task Workflows\n\n`;
    tasks.forEach((t, idx) => {
      const taskFacts = facts.filter((f) => f.task_id === t.id);

      md += `### 4.${idx + 1} Task: ${cleanText(t.name)}\n\n`;
      md += `- **Cadence / Frequency:** ${cleanText(t.frequency || "Ad-hoc")}\n`;
      md += `- **Priority Level:** ${cleanText(t.priority || "Medium")}\n`;
      md += `- **Operational Status:** \`${cleanText(t.status)}\`\n`;

      if (t.coverage && Object.keys(t.coverage).length > 0) {
        const covKeys = Object.entries(t.coverage)
          .filter(([_, score]) => (score as number) > 0)
          .map(([k, score]) => `${formatCategory(k)}: ${score}%`);
        if (covKeys.length > 0) {
          md += `- **Knowledge Coverage:** ${covKeys.join(" • ")}\n`;
        }
      }
      md += `\n`;

      if (taskFacts.length === 0) {
        md += `> *Detailed procedural steps for this task are pending or in progress.*\n\n`;
      } else {
        const byCat: Record<string, string[]> = {};
        taskFacts.forEach((f) => {
          const c = f.category || "misc";
          if (!byCat[c]) byCat[c] = [];
          byCat[c].push(cleanText(f.fact_text));
        });

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

  // 5. Cross-Cutting Knowledge
  const generalFacts = facts.filter((f) => !f.task_id);
  if (generalFacts.length > 0) {
    md += `## 5. Organization Knowledge & Cross-Department Collaboration\n\n`;
    const genByCat: Record<string, string[]> = {};
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

  // 6. Evidence Artifacts
  if (uploads && uploads.length > 0) {
    md += `## 6. Document & Evidence Artifacts\n\n`;
    md += `| File Name | Type | Description | Created |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;
    uploads.forEach((u) => {
      md += `| **${cleanText(u.file_name || "Attachment")}** | \`${u.type || "file"}\` | ${cleanText(u.description || "Uploaded evidence")} | ${u.created_at ? u.created_at.split("T")[0] : "—"} |\n`;
    });
    md += `\n---\n\n`;
  }

  md += `\n*Automatically synced by Employee Knowledge OS to Google Drive*\n`;
  return md;
}

/**
 * Syncs one employee's SOP Markdown document to Google Drive.
 */
export async function syncEmployeeSopToDrive(employeeId: string): Promise<string | null> {
  const gDriveFolder = process.env.GDRIVE_FOLDER_ID;
  const gDriveKey = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!gDriveFolder || !gDriveKey) {
    console.warn("[DriveSync] Skipped: GDRIVE_FOLDER_ID or GOOGLE_SERVICE_ACCOUNT_JSON not configured.");
    return null;
  }

  const db = getServiceClient();

  // 1. Fetch employee data
  const [empRes, tasksRes, factsRes, uploadsRes] = await Promise.all([
    db.from("employees").select("*").eq("id", employeeId).maybeSingle(),
    db.from("tasks").select("*").eq("employee_id", employeeId).order("created_at", { ascending: true }),
    db.from("facts").select("*").eq("employee_id", employeeId).order("created_at", { ascending: true }),
    db.from("uploads").select("*").eq("employee_id", employeeId).order("created_at", { ascending: true }),
  ]);

  if (!empRes.data) {
    console.warn(`[DriveSync] Employee ${employeeId} not found.`);
    return null;
  }

  const employee = empRes.data;
  const tasks = tasksRes.data ?? [];
  const facts = factsRes.data ?? [];
  const uploads = uploadsRes.data ?? [];

  // 2. Synthesize Markdown
  const markdown = buildSopMarkdown(employee, tasks, facts, uploads);
  const safeSlug = (employee.full_name || "employee").replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const fileName = `${safeSlug}_sop.md`;

  // 3. Save local copy for offline caching / backup
  try {
    const localDir = path.resolve(process.cwd(), "exports", "sops");
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true });
    }
    fs.writeFileSync(path.join(localDir, fileName), markdown, "utf-8");
  } catch (fsErr) {
    console.warn("[DriveSync] Local file caching warning:", fsErr);
  }

  // 4. Connect to Google Drive
  const credentials = JSON.parse(gDriveKey);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  const drive = google.drive({ version: "v3", auth });

  // 5. Check if file exists in target Shared Drive folder
  const listRes = await drive.files.list({
    q: `'${gDriveFolder}' in parents and name = '${fileName}' and trashed = false`,
    fields: "files(id, name, webViewLink)",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const existingFile = listRes.data.files?.[0];

  const stream = new Readable();
  stream.push(markdown);
  stream.push(null);

  if (existingFile?.id) {
    const updateRes = await drive.files.update({
      fileId: existingFile.id,
      media: {
        mimeType: "text/markdown",
        body: stream,
      },
      fields: "id, name, webViewLink",
      supportsAllDrives: true,
    });
    console.log(`[DriveSync] Updated ${fileName} in Drive: ${updateRes.data.webViewLink}`);
    return updateRes.data.webViewLink ?? null;
  } else {
    const createRes = await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [gDriveFolder],
      },
      media: {
        mimeType: "text/markdown",
        body: stream,
      },
      fields: "id, name, webViewLink",
      supportsAllDrives: true,
    });
    console.log(`[DriveSync] Uploaded new ${fileName} to Drive: ${createRes.data.webViewLink}`);
    return createRes.data.webViewLink ?? null;
  }
}

/**
 * Fire-and-forget helper: runs the sync in the background so HTTP routes return immediately.
 */
export function triggerBackgroundDriveSync(employeeId: string): void {
  syncEmployeeSopToDrive(employeeId).catch((err) => {
    console.error(`[DriveSync] Background sync failed for ${employeeId}:`, err?.message || err);
  });
}
