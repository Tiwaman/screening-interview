import { NextResponse } from "next/server";
import {
  authenticateExtensionRequest,
  EXT_CORS_HEADERS,
} from "@/lib/extension-auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { createInterviewForUser } from "@/lib/interviews/create";

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

export async function POST(request: Request) {
  const auth = await authenticateExtensionRequest(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: EXT_CORS_HEADERS },
    );
  }

  const formData = await request.formData();
  const admin = getAdminClient();

  const result = await createInterviewForUser(admin, auth.userId, {
    roleTitle: (formData.get("role_title") as string | null) ?? "",
    seniority: (formData.get("seniority") as string | null) ?? "",
    jdText: (formData.get("jd_text") as string | null) ?? null,
    resumeFile: formData.get("resume") as File | null,
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: 400, headers: EXT_CORS_HEADERS },
    );
  }

  return NextResponse.json(
    { id: result.id },
    { status: 201, headers: EXT_CORS_HEADERS },
  );
}
