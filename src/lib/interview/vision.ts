import { config } from "@/lib/config";

/**
 * Read an image (or scanned PDF page) using the multimodal LLM via OpenRouter,
 * returning a faithful text transcription/description. Used when a file has no
 * extractable text. Returns "" on failure so uploads never break.
 */
export async function describeImage(buf: Buffer, mime: string): Promise<string> {
  try {
    const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
    const res = await fetch(config.openrouter.baseUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.openrouter.apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "Employee Knowledge OS",
      },
      body: JSON.stringify({
        model: config.openrouter.model,
        temperature: 0,
        max_tokens: 1500,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text:
                  "This is a work document/screenshot an employee uploaded (may be a sheet, checklist, or task list). " +
                  "Transcribe ALL visible text faithfully. If it is a table, output it row by row with columns. " +
                  "Do not add commentary or invent anything.",
              },
              { type: "image_url", image_url: { url: dataUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    return typeof content === "string" ? content.trim() : "";
  } catch {
    return "";
  }
}
