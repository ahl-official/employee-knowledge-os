# 🧠 How the AI Knowledge Extraction System Works

## 🎯 The Core Purpose
When an employee leaves the company, **80% of their operational know-how is undocumented** (stored only in their head: shortcuts, login portals, exact spreadsheets, exception rules, and who to contact).

This AI system acts as a **Digital Knowledge Architect** that interviews the departing employee to extract **100% of their working knowledge** so you can:
1. **Create training videos** (HeyGen, Loom, etc.) for new joiners.
2. **Generate Standard Operating Procedures (SOPs)** in PDF & Markdown.
3. **Onboard new employees** to work independently on Day 1 without bothering seniors.

---

## 🔄 The 3-Phase Interview Pipeline

```
Phase 1: Profile (0-20%)  →  Phase 2: Task Catalog (20-30%)  →  Phase 3: Deep-Dive & Probing (30-100%)
(Name, Role, Manager)        (Lists Daily/Weekly/Monthly)       (Extracts 12 Dimensions & Exceptions)
```

### 1️⃣ Phase 1: Role Profile (Deterministic)
* Captures: Full Name, Department, Designation, Reporting Manager, Experience, and Core Responsibilities.
* *Saved directly into the employee record.*

### 2️⃣ Phase 2: Task Cataloging
* The AI asks: *"What are your daily, weekly, monthly, and occasional tasks?"*
* The employee types or uploads a checklist/sheet.
* The AI automatically parses these into discrete tasks in the database (e.g., *Daily Bank Reconciliation*, *Vendor Invoice Entry*, *TDS Filing*).

### 3️⃣ Phase 3: Deep Probing (The Magic Engine)
* The AI takes **ONE task at a time** and methodically probes until all **12 operational dimensions** are answered.

---

## 📊 The 12 Knowledge Dimensions Extracted Per Task

To ensure a new person or training video has **zero missing gaps**, the AI checks every task against 12 dimensions:

| # | Dimension | What the AI Extracts | Example Question the AI Asks |
|---|---|---|---|
| **1** | **Work Source** | Who assigns the task & how it arrives | *"How do you know when to start this task?"* |
| **2** | **Inputs** | Files, links, raw data needed | *"What files or credentials do you need before starting?"* |
| **3** | **Steps** | Exact step-by-step workflow | *"Walk me through the exact sequence from start to finish."* |
| **4** | **Research** | References, lookups, past samples | *"Do you cross-check any past records or formulas?"* |
| **5** | **Tools & Portals** | Software names, portals, templates | *"Which exact portal and screen do you use?"* |
| **6** | **Decisions** | Judgment calls and rules of thumb | *"How do you decide between Option A and Option B?"* |
| **7** | **Exceptions** | When things don't follow the normal path | *"What if an invoice is missing a PO number?"* |
| **8** | **Failure Handling** | What breaks and how to fix it | *"What is the most common error and how do you resolve it?"* |
| **9** | **Quality Check** | Self-checks before sending | *"What numbers do you verify before submitting?"* |
| **10**| **Approvals** | Who reviews & how sign-off is given | *"Who approves this, and is it via Slack, email, or system?"* |
| **11**| **Outputs** | Final file format & where it is saved | *"Where is the final file saved (Drive folder/Sheet link)?"* |
| **12**| **Evidence** | Real examples, screenshots, sheets | *"Can you upload an example of a completed sheet?"* |

---

## 🛡️ The "Bullshit Detector" & Real-Time Probing

Employees often give short, lazy, or vague answers. The AI uses **3 Golden Tests** before accepting any answer:

```
[Employee Answer] ───→ [1. Specific?] ───→ [2. Complete?] ───→ [3. Reproducible?] ───→ Accepted?
                             │                    │                    │
                            NO                   NO                   NO
                             │                    │                    │
                             └────────────→ [PROBE DEEPER] ←───────────┘
```

### Real Examples of AI Probing:

* **Vague Answer:** *"I update the sheet and send it to Sir."*  
  👉 **AI Follow-up:** *"Who is Sir (name and designation), and how do you send it to him (Email, Slack, or Google Drive)?"*

* **Missing Exception:** *"I match the portal numbers with Excel."*  
  👉 **AI Follow-up:** *"What do you do if the numbers in the portal and Excel do not match?"*

* **Unexplained Jargon:** *"I download the BRS and post the JV."*  
  👉 **AI Follow-up:** *"Which software do you use to download the BRS, and under which company entity do you post the JV?"*

---

## 📎 Multimodal Document & Screenshot Reading

Employees can click the **📎 Upload button** to share:
* **Excel / CSV Sheets**: The AI reads row-by-row columns.
* **PDFs & Word Docs**: Extracted text is fed into the interview.
* **Screenshots / Photos**: Read via multimodal vision AI (OCR).
* **Google Drive**: All uploads automatically back up to your connected company Shared Drive.

---

## 📄 Output: From Chat to Executive Training Kit

Once the interview hits 100%, you get:

1. **Structured SOP (PDF & Markdown)**:
   * Formatted using the **PSS Framework** (*Process, Structure, System*).
   * Includes step-by-step instructions, exceptions, tool lists, and sign-off blocks.
2. **HeyGen Video Script Ready**:
   * Contains exact inputs, screens, common mistakes, and step breakdowns ready to paste into video creators.
3. **Claude & NotebookLM Ready**:
   * Complete, structured knowledge base facts ready to upload to department AI projects.
