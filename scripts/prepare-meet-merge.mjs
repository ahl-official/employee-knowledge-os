import fs from "fs";
import path from "path";

// Load existing facts
const existingFacts = JSON.parse(fs.readFileSync("meet_existing_facts.json", "utf8"));
const existingTexts = existingFacts.map((f) => f.fact_text.toLowerCase().trim());

// Helper to check similarity / duplicate
function isDuplicate(newText) {
  const norm = newText.toLowerCase().trim();
  return existingTexts.some((ex) => {
    if (ex === norm) return true;
    // Check heavy overlap
    if (norm.length > 20 && ex.includes(norm)) return true;
    if (ex.length > 20 && norm.includes(ex)) return true;
    return false;
  });
}

// Meet Task IDs
const TASK_TRAINING = "f097752e-2526-4215-9acd-ebd994259562";
const TASK_HR_SYSTEM = "3bec2b7c-7285-4317-9893-e3125ebf48b4";
const TASK_FEEDBACK = "bcc622fb-7f9d-4b25-ad6e-8f667e0b014c";
const TASK_EOD = "e836b3c8-0610-4925-ae2b-118218d4190d";
const TASK_LEAVING = "9d603959-d432-4304-ac6f-05233a8cf795";

export const candidateFacts = [
  // --- TRAINING: Trigger, Roles, High-level ---
  {
    category: "work_source",
    task_name: "training",
    fact_text: "Vineet sir (CEO) gives timelines for training video completion, typically within 10 to 15 days.",
  },
  {
    category: "steps",
    task_name: "training",
    fact_text: "To capture training content, Meet first extracts and arranges all topics from the subject matter expert.",
  },
  {
    category: "steps",
    task_name: "training",
    fact_text: "Meet creates an initial index with sub-chapters before writing the full training script.",
  },
  {
    category: "tools",
    task_name: "training",
    fact_text: "TurboScribe AI tool is used to transcribe the audio recordings of the subject matter experts.",
  },
  {
    category: "work_source",
    task_name: "training",
    fact_text: "Meet was introduced to TurboScribe by former senior Palak who handled the role previously.",
  },
  {
    category: "tools",
    task_name: "training",
    fact_text: "The transcribed text is put into ChatGPT Pro to structure the content and generate the chapter index and script.",
  },
  {
    category: "tools",
    task_name: "training",
    fact_text: "Saburi created two custom ChatGPT prompts for training creation: one prompt with script format, and one without script format.",
  },
  {
    category: "steps",
    task_name: "training",
    fact_text: "As an alternative to raw audio dumps, Vineet sir recommended an interview-based approach where Meet uses the expert's task sheet to formulate questions and elicit spoken answers.",
  },
  {
    category: "decisions",
    task_name: "training",
    fact_text: "Vineet sir instructed that conceptual knowledge should be converted into HeyGen AI avatar videos, while practical demonstrations must be shot physically.",
  },
  {
    category: "approval",
    task_name: "training",
    fact_text: "After ChatGPT creates the index and script, Meet presents it to the subject matter expert (e.g. Pooja ma'am) for review and approval.",
  },
  {
    category: "steps",
    task_name: "training",
    fact_text: "If the subject matter expert requests modifications to the training script, Meet makes the changes and secures re-approval before proceeding to shoot.",
  },

  // --- TRAINING: Studio, Room Booking, Zenoti, Scheduling ---
  {
    category: "exceptions",
    task_name: "training",
    fact_text: "Room Number One and adjoining rooms are also used for AHL / LK Men salon client appointments when upstairs salon is full.",
  },
  {
    category: "steps",
    task_name: "training",
    fact_text: "Before scheduling a shoot, Meet checks room availability in the Zenoti system.",
  },
  {
    category: "exceptions",
    task_name: "training",
    fact_text: "If client appointments arrive in Room Number One during a shoot, the recording must pause or be rescheduled.",
  },
  {
    category: "exceptions",
    task_name: "training",
    fact_text: "Consultants have very tight schedules; coordinating shoot timings around their busy client appointments is Meet's biggest operational challenge.",
  },
  {
    category: "exceptions",
    task_name: "training",
    fact_text: "For urgent high-priority shoots with senior technicians who have packed client schedules (like Faheem), shoots have extended as late as 1:00 AM.",
  },

  // --- TRAINING: Shoot Preparation & Execution ---
  {
    category: "steps",
    task_name: "training",
    fact_text: "The GoPro camera is sourced from the editing team and set up near the mirror in Room Number One.",
  },
  {
    category: "quality_check",
    task_name: "training",
    fact_text: "On the morning of a shoot day, Meet checks the GoPro camera battery and microphone, plugging them in immediately if charging is needed.",
  },
  {
    category: "steps",
    task_name: "training",
    fact_text: "During the shoot, only Meet and the subject matter expert are present in the room.",
  },
  {
    category: "failure_handling",
    task_name: "training",
    fact_text: "When speakers struggle or take repeated retakes, Meet builds rapport, reassures them, and encourages them to speak naturally in simple Hindi rather than formal language.",
  },

  // --- TRAINING: NAS Ingestion & Video Pipeline ---
  {
    category: "tools",
    task_name: "training",
    fact_text: "Meet opens NAS by going to File Explorer, clicking Network at the bottom, and opening the NAS folder.",
  },
  {
    category: "steps",
    task_name: "training",
    fact_text: "Footage from the card reader is transferred into the 'data to work' directory on NAS, arranged by Topic Name, Videos folder, and clip numbers.",
  },
  {
    category: "contact",
    task_name: "training",
    fact_text: "Kunal manages administrator access for NAS storage and assists if there are access or network issues.",
  },
  {
    category: "steps",
    task_name: "training",
    fact_text: "Once shoot footage is uploaded to 'data to work', Meet informs Editing Manager Mohit via WhatsApp with the topic name and employee name.",
  },
  {
    category: "steps",
    task_name: "training",
    fact_text: "Editors place edited videos in Kunal's NAS folder; Kunal then moves them to Meet's designated NAS folder named 'Meet'.",
  },
  {
    category: "quality_check",
    task_name: "training",
    fact_text: "Meet creates a temporary staging folder and copies the edited video there first rather than working directly off the original file.",
  },
  {
    category: "approval",
    task_name: "training",
    fact_text: "Edited videos (including HeyGen AI avatar videos) require formal approval before being uploaded to YouTube.",
  },
  {
    category: "steps",
    task_name: "training",
    fact_text: "Edited training videos are uploaded to the company YouTube channel as unlisted videos for internal sharing.",
  },
  {
    category: "tools",
    task_name: "training",
    fact_text: "Kunal built an MIS Google Sheet tracker with dropdowns for video name, editor, person featured, NAS status, and uploaded status.",
  },
  {
    category: "steps",
    task_name: "training",
    fact_text: "Meet enters video details in the NAS section of Kunal's MIS tracker sheet, and updates it to the Uploaded section once successfully uploaded.",
  },

  // --- TRAINING: YouTube Playlists & Google Sites Training Hub ---
  {
    category: "output",
    task_name: "training",
    fact_text: "Meet creates department-wise and topic-wise YouTube playlists (such as for Technicians) so videos can be shared together.",
  },
  {
    category: "tools",
    task_name: "training",
    fact_text: "Meet created a Google Site training portal consolidating training video playlists so leadership (Vineet sir) can instantly access them in meetings.",
  },
  {
    category: "output",
    task_name: "training",
    fact_text: "New joiners watch the uploaded training videos and take an AI assessment test based on the video contents.",
  },

  // --- HEYGEN AI AVATAR VIDEOS ---
  {
    category: "steps",
    task_name: "HeyGen AI Avatar Videos",
    fact_text: "For conceptual training modules, Meet coordinates with the AI department, handing over approved scripts to create HeyGen AI avatar videos.",
  },
  {
    category: "approval",
    task_name: "HeyGen AI Avatar Videos",
    fact_text: "AI department returns the generated HeyGen avatar video, which undergoes approval before YouTube upload.",
  },

  // --- FEEDBACK FORM & EMPLOYEE 1-ON-1S ---
  {
    category: "steps",
    task_name: "feedback form",
    fact_text: "Meet conducts 1-on-1 confidential feedback interviews with employees, based on daily instructions from Amit sir specifying whom to interview.",
  },
  {
    category: "inputs",
    task_name: "feedback form",
    fact_text: "In the 1-on-1 feedback session, Meet asks how long the employee has been with the company, support received from seniors/managers, and any problems or challenges faced.",
  },
  {
    category: "decisions",
    task_name: "feedback form",
    fact_text: "Feedback notes in the report are color-coded: Red indicates urgent issues requiring immediate attention, Yellow indicates areas to monitor, and Green indicates positive feedback.",
  },
  {
    category: "decisions",
    task_name: "feedback form",
    fact_text: "Meet decides the color coding (Red, Yellow, Green) for employee feedback points based on his judgment of urgency.",
  },
  {
    category: "steps",
    task_name: "feedback form",
    fact_text: "Employee feedback discussions are kept strictly confidential and shared only with Amit sir.",
  },
  {
    category: "tools",
    task_name: "feedback form",
    fact_text: "Meet also participated in testing an anonymous employee feedback mechanism introduced by Tanmay.",
  },

  // --- INDEED JOB POSTING & RECRUITMENT ---
  {
    category: "steps",
    task_name: "Indeed Job Posting & Sponsoring",
    fact_text: "Every morning, Meet spends 30 to 45 minutes on the Indeed application managing candidate hiring with Rakesh sir.",
  },
  {
    category: "steps",
    task_name: "Indeed Job Posting & Sponsoring",
    fact_text: "Meet sponsors active job posts on Indeed (e.g. for CRM roles, interns) so company listings rank first in candidate search recommendations.",
  },
  {
    category: "tools",
    task_name: "Indeed Job Posting & Sponsoring",
    fact_text: "Candidate hiring also utilizes Internshala and a LinkedIn hiring automation developed by Shanya.",
  },

  // --- FMS & CANDIDATE LIFECYCLE ---
  {
    category: "steps",
    task_name: "HR system",
    fact_text: "Candidate entries in the FMS Google Sheet progress through stages: interested/drop/under-review, interview scheduled, confirmation call, joining date, shortlisted, and onboarded.",
  },
  {
    category: "steps",
    task_name: "HR system",
    fact_text: "When a candidate completes onboarding, their record moves into the 'Employee Lifecycle' section of the FMS sheet.",
  },

  // --- TASK DELEGATION, APPROVALS & EOD ---
  {
    category: "work_source",
    task_name: "EOD sheet",
    fact_text: "One-time tasks are assigned on the 'Task Delegation' WhatsApp group by Vineet sir, Amit sir, or Rakesh sir with the employee tagged by name.",
  },
  {
    category: "approval",
    task_name: "EOD sheet",
    fact_text: "Before marking a delegated task complete, Meet demonstrates the finished work to Amit sir for approval.",
  },
  {
    category: "steps",
    task_name: "EOD sheet",
    fact_text: "After Amit sir approves a task, Meet quotes the task message from Process Coordinator Tejal ma'am on WhatsApp and replies 'Done'.",
  },
  {
    category: "decisions",
    task_name: "EOD sheet",
    fact_text: "Training tasks take top priority; if a scripting deadline falls on the same day as a scheduled shoot, Meet reschedules the shoot to complete scripting by EOD.",
  },
  {
    category: "failure_handling",
    task_name: "EOD sheet",
    fact_text: "If employees in other departments (like salon) do not cooperate or delay required HR forms, Meet escalates to Amit sir or references Vineet sir's instructions to drive completion.",
  },
  {
    category: "steps",
    task_name: "Staff Leaving Form",
    fact_text: "For the Staff Leaving Form, clicking the link opens the camera, and Meet takes a photo of his tidy workstation setup to submit to Tejal ma'am.",
  },

  // --- CONTACTS & BACKGROUND ---
  {
    category: "contact",
    task_name: "training",
    fact_text: "Pooja ma'am is the Hair Consultant who provided the foundational knowledge for hair training videos and scripts.",
  },
  {
    category: "contact",
    task_name: "training",
    fact_text: "Consultants regularly coordinated with for training video scripting and shoots include Sejal ma'am, Pooja ma'am, Nancy ma'am, and Gauri ma'am.",
  },
  {
    category: "contact",
    task_name: "training",
    fact_text: "Faheem is the Senior Hair Technician who handles intensive client schedules and required specialized shoot coordination.",
  },
  {
    category: "contact",
    task_name: "training",
    fact_text: "Palak was Meet's predecessor who handed over training scripts and guided him during her one-month notice period.",
  },
  {
    category: "contact",
    task_name: "training",
    fact_text: "Saburi is a team member who designed ChatGPT prompt templates for training script generation.",
  },
  {
    category: "contact",
    task_name: "EOD sheet",
    fact_text: "Tejal ma'am is the Process Coordinator who oversees company-wide tasks and manages completion updates on WhatsApp.",
  },
  {
    category: "misc",
    task_name: "training",
    fact_text: "Meet joined the company as a fresher after completing an MSc in IT, dividing his responsibilities 50-50 between training video development and HR operational tasks.",
  },
  {
    category: "tools",
    task_name: "training",
    fact_text: "Meet uses Google Gemini to draft forms and documents when needed.",
  },
];

console.log("Total candidate facts:", candidateFacts.length);
const newFacts = candidateFacts.filter((f) => !isDuplicate(f.fact_text));
console.log("Filtered new (non-duplicate) facts:", newFacts.length);
const dupes = candidateFacts.filter((f) => isDuplicate(f.fact_text));
console.log("Duplicates skipped:", dupes.length);
if (dupes.length > 0) {
  console.log("Sample duplicates skipped:", dupes.map((d) => d.fact_text));
}
