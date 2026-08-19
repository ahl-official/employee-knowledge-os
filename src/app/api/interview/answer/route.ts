import { NextResponse } from "next/server";
import { assertServerEnv } from "@/lib/config";
import { getEmployeeByToken, processAnswer } from "@/lib/interview/store";
import { checkRateLimit } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST /api/interview/answer { token, answer } — submit one answer, get next question. */
export async function POST(req: Request) {
  try {
    assertServerEnv();
    const body = await req.json();
    const token = (body.token ?? "").toString();
    const answer = (body.answer ?? "").toString().trim();
    if (!token) return NextResponse.json({ error: "token required" }, { status: 400 });
    if (!answer) return NextResponse.json({ error: "answer required" }, { status: 400 });

    const employee = await getEmployeeByToken(token);
    if (!employee) return NextResponse.json({ error: "invalid_token" }, { status: 404 });

    if (!checkRateLimit(`ans_${employee.id}`, 30, 60_000)) {
      return NextResponse.json(
        { error: "Too many messages sent. Please pause for a moment." },
        { status: 429 }
      );
    }

    const outcome = await processAnswer(token, answer);
    return NextResponse.json(outcome);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "server_error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
