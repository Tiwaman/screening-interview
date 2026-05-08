import { NextResponse } from "next/server";
import {
  authenticateExtensionRequest,
  EXT_CORS_HEADERS,
} from "@/lib/extension-auth";
import { getAdminClient } from "@/lib/supabase/admin";

export async function OPTIONS() {
  return new NextResponse(null, { headers: EXT_CORS_HEADERS });
}

export async function GET(request: Request) {
  const auth = await authenticateExtensionRequest(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: EXT_CORS_HEADERS },
    );
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("interviews")
    .select("id, role_title, seniority, status, created_at")
    .eq("user_id", auth.userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: EXT_CORS_HEADERS },
    );
  }

  return NextResponse.json(
    { interviews: data ?? [] },
    { headers: EXT_CORS_HEADERS },
  );
}
