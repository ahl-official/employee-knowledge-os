# 🚀 Knowledge OS: Multi-Round AI Interviews & Auto PDF SOP Export

This document contains the **Implementation Plan** and the **Starter Prompt** to give to a new AI Agent to execute these features seamlessly.

---

## 📋 Starter Prompt (Copy & Paste to New Agent)

```text
Please read docs/MULTI_ROUND_AND_PDF_PLAN.md and execute the implementation plan step-by-step:

1. Implement the Multi-Round Interview system (Round 2 Gap Probing):
   - Update `src/lib/interview/prompt.ts` with the Round 2 gap-probing prompt.
   - Update `src/lib/interview/engine.ts` and `src/lib/interview/store.ts` to support round transitions, gap analysis, and branch resolution.
   - Create `src/app/api/admin/round/route.ts` to allow admins to start Round 2 for an employee.

2. Implement Auto SOP Formatting & PDF Export:
   - Create `src/app/api/admin/sop/pdf/route.ts` rendering print-ready, PSS-framework structured HTML/PDF.
   - Add "Export PDF" button and "Start Round 2" button to `src/app/admin/page.tsx`.
   - Update `src/app/interview/[token]/InterviewClient.tsx` with Round badge indicators.

3. Verify with a simulation test and run `npx tsc --noEmit` and `npm run lint` to ensure zero errors.

Proceed autonomously with high code quality and clean UI standards.
```

---

## 🏗️ Detailed Architecture & Implementation Specification

### 1. Multi-Round AI Architecture (Round 2 Gap Probing)

#### A. Database Schema
The `sessions` and `employees` tables already support `round` (integer) and `status`.
* `round = 1`: Initial Discovery (Profile $\rightarrow$ Task Catalog $\rightarrow$ First-pass Deep Dive).
* `round = 2`: Gap Probing (Focus strictly on open branches and task dimensions with $< 60\%$ coverage).

#### B. Prompt Layer (`src/lib/interview/prompt.ts`)
Add `GAP_PROBING_SYSTEM_PROMPT` for Round 2:
* Skip generic introductions.
* Model objective: Systematically probe unresolved branches and low-coverage dimensions (`exceptions`, `failure_handling`, `tools`, `approvals`, `inputs`).
* Mark round complete once open branches are resolved and key dimensions reach $\ge 70\%$.

#### C. Engine & Store (`src/lib/interview/engine.ts` & `src/lib/interview/store.ts`)
* In `runInterviewTurn`, inject current `round` and the list of specific open gaps into the prompt context.
* Add `startNewRound(employeeId, targetRound)`:
  * Increments `round = 2`, resets session status to `active`.
  * Computes initial gap summary and posts an opening question like:
    *"Welcome back [Name]! In Round 2, I have just a few targeted follow-up questions to complete the details on [Task Name] regarding [Open Branch]."*

#### D. Admin API (`src/app/api/admin/round/route.ts`)
* `POST /api/admin/round`
  * Body: `{ employee_id: string, round: number }`
  * Verifies admin passphrase (`isAdmin(req)`).
  * Calls `startNewRound` and returns the updated employee and interview URL.

---

### 2. Auto SOP Formatting & PDF Export (PSS Framework)

#### Structure (Process, Structure, System):
1. **Executive Header**: Company Name, Employee, Role, Department, Manager, Date, Version.
2. **Process Breakdown**:
   * Objective & Trigger
   * Step-by-Step Workflow
   * Inputs & Pre-requisites
   * Output & Deliverables
   * Exception Handling & Edge Cases
   * Quality Check & Approval Matrix
3. **Structure & Storage**:
   * Google Drive / Sheet locations
   * File naming conventions
   * Escalation contacts
4. **System & Tools**:
   * Tool name, version, maker/checker credentials, URLs/Portals.

#### Implementation (`src/app/api/admin/sop/pdf/route.ts`):
* `GET /api/admin/sop/pdf?employee_id=...`
* Compiles facts and tasks into a self-contained, print-styled HTML document with `@media print { ... }` CSS:
  * Page margins (`@page { margin: 15mm; size: A4; }`)
  * Page-break rules (`page-break-inside: avoid;`)
  * Auto-triggering `window.print()` on load, or serving directly as a printable view.

---

### 3. UI Modifications

#### Admin Dashboard (`src/app/admin/page.tsx`):
* Display `Round 1` or `Round 2` badge next to status.
* In Employee Drawer:
  * Add **"Start Round 2 (Gaps)"** button when Round 1 is complete.
  * Add **"Export PDF"** button next to "Export SOP".

#### Interview Client (`src/app/interview/[token]/InterviewClient.tsx`):
* Display a clean top badge when in Round 2: `Round 2 · Gap Clarifications`.

---

## 🧪 Verification & Checklist
- [ ] Run `npx tsc --noEmit` (Must pass with 0 errors)
- [ ] Run `npm run lint` (Must pass with 0 errors)
- [ ] Test Round 2 flow with a simulation script (`scripts/test-round2.mjs`)
- [ ] Test PDF export endpoint in the browser
