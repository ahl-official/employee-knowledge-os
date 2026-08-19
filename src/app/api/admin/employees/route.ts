import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { isAdmin } from "@/lib/adminAuth";
import { generateAccessToken } from "@/lib/tokens";
import { assertServerEnv } from "@/lib/config";

export const runtime = "nodejs";

/** GET: list all employees with progress (admin only). */
export async function GET(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    assertServerEnv();
    const db = getServiceClient();
    const { data, error } = await db
      .from("employees")
      .select(
        "id, full_name, department, designation, reporting_manager, status, overall_progress, access_token, created_at, last_activity"
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const withLinks = (data ?? []).map((e) => ({
      ...e,
      interview_url: `${baseUrl}/interview/${e.access_token}`,
    }));
    return NextResponse.json({ employees: withLinks });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "server_error" },
      { status: 500 }
    );
  }
}

/** POST: create an employee and return their interview link (admin only). */
export async function POST(req: Request) {
  if (!isAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    assertServerEnv();
    const body = await req.json();
    const fullName = (body.full_name ?? "").toString().trim();
    if (!fullName) return NextResponse.json({ error: "full_name required" }, { status: 400 });

    const db = getServiceClient();
    const access_token = generateAccessToken();
    const { data, error } = await db
      .from("employees")
      .insert({
        full_name: fullName,
        department: body.department?.toString().trim() || null,
        designation: body.designation?.toString().trim() || null,
        reporting_manager: body.reporting_manager?.toString().trim() || null,
        access_token,
        status: "invited",
      })
      .select("id, full_name, access_token")
      .single();
    if (error) throw error;

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    return NextResponse.json({
      employee: data,
      interview_url: `${baseUrl}/interview/${access_token}`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "server_error" },
      { status: 500 }
    );
  }
}
