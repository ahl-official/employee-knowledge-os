import { NextResponse } from "next/server";
import { assertServerEnv } from "@/lib/config";
import { getServiceClient } from "@/lib/supabase";
import { getEmployeeByToken, processDocument } from "@/lib/interview/store";
import { extractFileText } from "@/lib/parse";
import { checkRateLimit } from "@/lib/rateLimit";
import { google } from "googleapis";
import { Readable } from "stream";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024; // 15 MB

/**
 * POST /api/upload  (multipart form-data: token, file)
 * Stores the original file in Supabase Storage, extracts text, records the
 * upload, and runs a grounded interview turn about it.
 */
export async function POST(req: Request) {
  try {
    assertServerEnv();
    const contentLength = Number(req.headers.get("content-length") || "0");
    if (contentLength > MAX_BYTES) {
      return NextResponse.json({ error: "File too large (max 15MB)" }, { status: 413 });
    }
    const form = await req.formData();
    const token = (form.get("token") ?? "").toString();
    const comment = (form.get("comment") ?? "").toString().trim();
    const file = form.get("file");
    if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "file too large (max 15MB)" }, { status: 400 });

    const employee = await getEmployeeByToken(token);
    if (!employee) return NextResponse.json({ error: "invalid_link" }, { status: 404 });

    if (!checkRateLimit(`up_${employee.id}`, 10, 60_000)) {
      return NextResponse.json(
        { error: "Upload rate limit exceeded. Please wait a moment before uploading another file." },
        { status: 429 }
      );
    }

    const buf = Buffer.from(await file.arrayBuffer());
    const mime = file.type || "application/octet-stream";
    const fileName = file.name || "upload";

    // 1) Store the original file (private bucket).
    const db = getServiceClient();
    const safeName = fileName.replace(/[^\w.\-]+/g, "_");
    const storagePath = `${employee.id}/${Date.now()}_${safeName}`;
    let storedPath: string | null = storagePath;
    const { error: upErr } = await db.storage.from("uploads").upload(storagePath, buf, {
      contentType: mime,
      upsert: false,
    });
    if (upErr) storedPath = null; // keep going even if storage fails; text still extracted

    // 1.5) Backup to Google Drive if configured.
    let driveUrl: string | null = null;
    const gDriveKey = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    const gDriveFolder = process.env.GDRIVE_FOLDER_ID;
    if (gDriveKey && gDriveFolder) {
      try {
        const credentials = JSON.parse(gDriveKey);
        const auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ["https://www.googleapis.com/auth/drive"],
        });
        const drive = google.drive({ version: "v3", auth });
        
        const stream = new Readable();
        stream.push(buf);
        stream.push(null);
        
        const res = await drive.files.create({
          requestBody: {
            name: fileName,
            parents: [gDriveFolder],
          },
          media: {
            mimeType: mime,
            body: stream,
          },
          fields: "id, webViewLink",
          supportsAllDrives: true,
        });
        driveUrl = res.data.webViewLink ?? null;
      } catch (driveErr) {
        console.error("Google Drive backup failed:", driveErr);
      }
    }

    // 2) Extract text (images/scanned PDFs go through the vision model).
    const { kind, text } = await extractFileText(buf, fileName, mime);

    // 3) Record + run a grounded interview turn.
    const outcome = await processDocument(token, {
      fileName,
      kind,
      mime,
      storagePath: storedPath,
      extractedText: text,
      driveUrl,
      comment,
    });

    return NextResponse.json({ ...outcome, fileName, kind, extracted: text.length > 0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "server_error";
    const status = msg === "invalid_token" ? 404 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
