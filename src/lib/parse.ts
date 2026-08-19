import * as XLSX from "xlsx";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { describeImage } from "@/lib/interview/vision";

export type UploadKind = "sheet" | "pdf" | "doc" | "image" | "link" | "other";

export function classify(fileName: string, mime: string): UploadKind {
  const n = fileName.toLowerCase();
  if (mime.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/.test(n)) return "image";
  if (/\.(xlsx|xls|csv)$/.test(n) || mime.includes("spreadsheet") || mime.includes("excel")) return "sheet";
  if (/\.pdf$/.test(n) || mime === "application/pdf") return "pdf";
  if (/\.(docx|doc)$/.test(n) || mime.includes("word")) return "doc";
  return "other";
}

/** Convert an Excel/CSV workbook buffer into a readable text table per sheet. */
function parseSheet(buf: Buffer): string {
  const wb = XLSX.read(buf, { type: "buffer" });
  const parts: string[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const csv = XLSX.utils.sheet_to_csv(ws, { blankrows: false });
    if (csv.trim()) parts.push(`--- Sheet: ${name} ---\n${csv.trim()}`);
  }
  return parts.join("\n\n");
}

async function parsePdf(buf: Buffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(buf));
  const { text } = await extractText(pdf, { mergePages: true });
  return (Array.isArray(text) ? text.join("\n") : text).trim();
}

async function parseDoc(buf: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return value.trim();
}

/**
 * Turn any uploaded file into text the AI can read. Images are read by the
 * vision model; documents are parsed with local libraries (free). Never throws —
 * returns an empty string on failure so upload still succeeds.
 */
export async function extractFileText(
  buf: Buffer,
  fileName: string,
  mime: string
): Promise<{ kind: UploadKind; text: string }> {
  const kind = classify(fileName, mime);
  try {
    switch (kind) {
      case "sheet":
        return { kind, text: parseSheet(buf) };
      case "pdf": {
        try {
          const text = await parsePdf(buf);
          if (text && text.length >= 20) return { kind, text };
        } catch {
          // Fall back to multimodal vision OCR if text extraction fails or PDF is scanned/encrypted
        }
        return { kind, text: await describeImage(buf, mime || "application/pdf") };
      }
      case "doc":
        return { kind, text: await parseDoc(buf) };
      case "image":
        return { kind, text: await describeImage(buf, mime || "image/png") };
      default:
        return { kind, text: "" };
    }
  } catch {
    return { kind, text: "" };
  }
}
