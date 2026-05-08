import { NextResponse } from "next/server";
import {
  authenticateExtensionRequest,
  EXT_CORS_HEADERS,
} from "@/lib/extension-auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { generateQuestionsForInterview } from "@/lib/interviews/questions";

export async function OPTIONS() {
  return new NextResponse(null, { headers: EXT_CORS_HEADERS });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateExtensionRequest(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: EXT_CORS_HEADERS },
    );
  }

  const { id } = await params;
  const admin = getAdminClient();
  const result = await generateQuestionsForInterview(admin, id, auth.userId);

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error },
      { status: 400, headers: EXT_CORS_HEADERS },
    );
  }

  return NextResponse.json({ ok: true }, { headers: EXT_CORS_HEADERS });
}
