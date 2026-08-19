import { NextResponse } from "next/server";
import { assertServerEnv } from "@/lib/config";
import { isAdmin } from "@/lib/adminAuth";
import { getServiceClient } from "@/lib/supabase";
import crypto from "crypto";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    assertServerEnv();
    const employeeId = new URL(req.url).searchParams.get("employee_id") ?? "";
    if (!employeeId) return NextResponse.json({ error: "employee_id required" }, { status: 400 });

    const db = getServiceClient();
    const [employeeReq, tasksReq, factsReq, uploadsReq] = await Promise.all([
      db.from("employees").select("*").eq("id", employeeId).maybeSingle(),
      db.from("tasks").select("*").eq("employee_id", employeeId).order("created_at", { ascending: true }),
      db.from("facts").select("category, fact_text, task_id").eq("employee_id", employeeId).order("created_at", { ascending: true }),
      db.from("uploads").select("file_name, type, drive_url, created_at").eq("employee_id", employeeId),
    ]);

    if (!employeeReq.data) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

    const employee = employeeReq.data;
    const tasks = tasksReq.data ?? [];
    const facts = factsReq.data ?? [];
    const uploads = uploadsReq.data ?? [];

    const nonce = crypto.randomBytes(16).toString("base64");

    function escapeHtml(str: string | null | undefined): string {
      if (!str) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Helper: Categorize facts into PSS framework
    function categorizePSS(taskFacts: { category: string; fact_text: string }[]) {
      const process: string[] = [];
      const structure: string[] = [];
      const system: string[] = [];
      const exceptions: string[] = [];
      const approvals: string[] = [];

      for (const f of taskFacts) {
        const cat = (f.category || "").toLowerCase();
        const text = escapeHtml(f.fact_text);
        if (cat.includes("step") || cat.includes("input") || cat.includes("output") || cat.includes("workflow")) {
          process.push(text);
        } else if (cat.includes("exception") || cat.includes("failure") || cat.includes("error")) {
          exceptions.push(text);
        } else if (cat.includes("approval") || cat.includes("quality") || cat.includes("review")) {
          approvals.push(text);
        } else if (cat.includes("sheet") || cat.includes("drive") || cat.includes("folder") || cat.includes("contact") || cat.includes("escalat")) {
          structure.push(text);
        } else if (cat.includes("tool") || cat.includes("system") || cat.includes("software") || cat.includes("portal") || cat.includes("template")) {
          system.push(text);
        } else {
          process.push(text);
        }
      }

      return { process, structure, system, exceptions, approvals };
    }

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>SOP - ${escapeHtml(employee.full_name)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

    :root {
      --primary: #1e40af;
      --primary-light: #eff6ff;
      --text: #0f172a;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --bg-card: #ffffff;
      --accent-process: #2563eb;
      --accent-structure: #059669;
      --accent-system: #7c3aed;
      --accent-exception: #dc2626;
      --accent-approval: #d97706;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      color: var(--text);
      background: #f8fafc;
      line-height: 1.6;
      font-size: 14px;
      padding: 30px;
    }

    .container {
      max-width: 900px;
      margin: 0 auto;
      background: #ffffff;
      padding: 40px;
      border-radius: 12px;
      border: 1px solid var(--border);
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    }

    /* Header */
    .header {
      border-bottom: 2px solid var(--primary);
      padding-bottom: 24px;
      margin-bottom: 30px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .header-title h1 {
      font-size: 24px;
      font-weight: 700;
      color: var(--primary);
      margin-bottom: 4px;
    }
    .header-title p {
      font-size: 13px;
      color: var(--text-muted);
    }
    .header-badge {
      background: var(--primary-light);
      color: var(--primary);
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border: 1px solid #bfdbfe;
    }

    /* Meta Grid */
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      background: #f8fafc;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 35px;
    }
    .meta-item {
      display: flex;
      flex-direction: column;
    }
    .meta-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--text-muted);
      letter-spacing: 0.5px;
    }
    .meta-value {
      font-size: 14px;
      font-weight: 600;
      color: var(--text);
      margin-top: 2px;
    }

    /* Section Headings */
    .section-title {
      font-size: 17px;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 16px;
      padding-bottom: 6px;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* Task Card */
    .task-card {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 24px;
      margin-bottom: 28px;
      background: #ffffff;
      page-break-inside: avoid;
    }
    .task-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #f1f5f9;
    }
    .task-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--text);
    }
    .task-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 12px;
      background: #f1f5f9;
      color: #475569;
    }

    /* PSS Section */
    .pss-block {
      margin-top: 16px;
    }
    .pss-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .pss-process { color: var(--accent-process); }
    .pss-structure { color: var(--accent-structure); }
    .pss-system { color: var(--accent-system); }
    .pss-exception { color: var(--accent-exception); }
    .pss-approval { color: var(--accent-approval); }

    .fact-list {
      list-style: none;
      padding-left: 0;
      margin-bottom: 14px;
    }
    .fact-list li {
      position: relative;
      padding-left: 18px;
      margin-bottom: 6px;
      font-size: 13.5px;
      color: #334155;
    }
    .fact-list li::before {
      content: "•";
      position: absolute;
      left: 4px;
      color: var(--text-muted);
      font-weight: bold;
    }

    /* Document Box */
    .doc-box {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-radius: 6px;
      padding: 12px 16px;
      margin-top: 20px;
      font-size: 13px;
    }

    /* Sign-off footer */
    .signoff-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 30px;
      margin-top: 40px;
      padding-top: 25px;
      border-top: 1px dashed var(--border);
      page-break-inside: avoid;
    }
    .signoff-box {
      border: 1px solid var(--border);
      padding: 16px;
      border-radius: 6px;
      background: #f8fafc;
    }
    .signoff-line {
      border-bottom: 1px solid #cbd5e1;
      height: 40px;
      margin-top: 20px;
    }

    /* Print styling */
    @media print {
      body { background: #ffffff; padding: 0; }
      .container { border: none; box-shadow: none; padding: 0; max-width: 100%; }
      .no-print { display: none; }
      @page { margin: 15mm; size: A4; }
    }

    .print-bar {
      margin-bottom: 20px;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    .btn-print {
      background: var(--primary);
      color: #ffffff;
      padding: 8px 18px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      border: none;
      cursor: pointer;
    }
    .btn-print:hover { background: #1d4ed8; }
  </style>
</head>
<body>

  <div class="print-bar no-print">
    <button class="btn-print" id="printBtn">🖨️ Print / Save as PDF</button>
  </div>

  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="header-title">
        <h1>Standard Operating Procedure (SOP)</h1>
        <p>Enterprise Knowledge Transfer & Process Specification</p>
      </div>
      <span class="header-badge">PSS Framework</span>
    </div>

    <!-- Metadata -->
    <div class="meta-grid">
      <div class="meta-item">
        <span class="meta-label">Personnel Name</span>
        <span class="meta-value">${escapeHtml(employee.full_name)}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Department</span>
        <span class="meta-value">${escapeHtml(employee.department) || "Operations"}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Designation / Role</span>
        <span class="meta-value">${escapeHtml(employee.designation) || "N/A"}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Reporting Manager</span>
        <span class="meta-value">${escapeHtml(employee.reporting_manager) || "N/A"}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Experience in Role</span>
        <span class="meta-value">${escapeHtml(employee.experience) || "N/A"}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Generated Date</span>
        <span class="meta-value">${escapeHtml(dateStr)}</span>
      </div>
      <div class="meta-item" style="grid-column: span 2;">
        <span class="meta-label">Primary Responsibility</span>
        <span class="meta-value">${escapeHtml(employee.main_responsibility) || "Knowledge base documentation"}</span>
      </div>
    </div>

    <!-- Tasks Breakdown -->
    <h2 class="section-title">Operational Tasks & Workflows</h2>

    ${tasks.length === 0 ? `<p style="color: var(--text-muted); font-style: italic;">No tasks recorded.</p>` : ""}

    ${tasks.map((task, idx) => {
      const taskFacts = facts.filter((f) => f.task_id === task.id);
      const { process, structure, system, exceptions, approvals } = categorizePSS(taskFacts);

      return `
      <div class="task-card">
        <div class="task-header">
          <span class="task-title">${idx + 1}. ${escapeHtml(task.name)}</span>
          <span class="task-badge">${escapeHtml(task.frequency ? task.frequency.toUpperCase() : "REGULAR")}</span>
        </div>

        <!-- 1. Process -->
        <div class="pss-block">
          <div class="pss-title pss-process">⚙️ 1. Process & Workflow</div>
          ${process.length > 0 ? `
            <ul class="fact-list">
              ${process.map((t) => `<li>${t}</li>`).join("")}
            </ul>
          ` : `<p style="font-size: 13px; color: var(--text-muted); margin-bottom: 10px;">Steps and standard workflow rules.</p>`}
        </div>

        <!-- 2. System & Tools -->
        ${system.length > 0 ? `
        <div class="pss-block">
          <div class="pss-title pss-system">💻 2. System & Software Tools</div>
          <ul class="fact-list">
            ${system.map((t) => `<li>${t}</li>`).join("")}
          </ul>
        </div>
        ` : ""}

        <!-- 3. Structure & Storage -->
        ${structure.length > 0 ? `
        <div class="pss-block">
          <div class="pss-title pss-structure">📁 3. Structure, Spreadsheets & Escalations</div>
          <ul class="fact-list">
            ${structure.map((t) => `<li>${t}</li>`).join("")}
          </ul>
        </div>
        ` : ""}

        <!-- 4. Exceptions & Edge Cases -->
        ${exceptions.length > 0 ? `
        <div class="pss-block">
          <div class="pss-title pss-exception">⚠️ 4. Exceptions, Edge Cases & Failure Handling</div>
          <ul class="fact-list">
            ${exceptions.map((t) => `<li>${t}</li>`).join("")}
          </ul>
        </div>
        ` : ""}

        <!-- 5. Quality & Approvals -->
        ${approvals.length > 0 ? `
        <div class="pss-block">
          <div class="pss-title pss-approval">✅ 5. Quality Check & Approval Gates</div>
          <ul class="fact-list">
            ${approvals.map((t) => `<li>${t}</li>`).join("")}
          </ul>
        </div>
        ` : ""}
      </div>
      `;
    }).join("")}

    <!-- Uploaded Documents / Artifacts -->
    ${uploads.length > 0 ? `
    <h2 class="section-title" style="margin-top: 35px;">Verified Documents & Templates</h2>
    <div class="doc-box">
      <ul class="fact-list" style="margin-bottom: 0;">
        ${uploads.map((u) => {
          const safeName = escapeHtml(u.file_name);
          const safeType = escapeHtml(u.type || "document");
          const safeUrl = u.drive_url ? escapeHtml(u.drive_url) : null;
          return `
          <li>
            <strong>${safeName}</strong> (${safeType})
            ${safeUrl ? `— <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color: var(--primary);">View in Google Drive</a>` : ""}
          </li>
        `;
        }).join("")}
      </ul>
    </div>
    ` : ""}

    <!-- Sign-off Section -->
    <div class="signoff-grid">
      <div class="signoff-box">
        <p style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Employee Handover Sign-off</p>
        <p style="font-size: 13px; font-weight: 600; margin-top: 4px;">${escapeHtml(employee.full_name)}</p>
        <div class="signoff-line"></div>
        <p style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">Signature & Date</p>
      </div>

      <div class="signoff-box">
        <p style="font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--text-muted);">Manager Approval Sign-off</p>
        <p style="font-size: 13px; font-weight: 600; margin-top: 4px;">${escapeHtml(employee.reporting_manager) || "Authorized Manager"}</p>
        <div class="signoff-line"></div>
        <p style="font-size: 11px; color: var(--text-muted); margin-top: 6px;">Signature & Date</p>
      </div>
    </div>

  </div>

  <script nonce="${nonce}">
    document.getElementById("printBtn")?.addEventListener("click", function() {
      window.print();
    });
  </script>
</body>
</html>`;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src data:; base-uri 'none'; form-action 'none';`,
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "server_error" },
      { status: 500 }
    );
  }
}
