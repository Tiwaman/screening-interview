import { NextResponse } from "next/server";
import {
  authenticateExtensionRequest,
  EXT_CORS_HEADERS,
} from "@/lib/extension-auth";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  updateQuestion,
  deleteQuestion,
} from "@/lib/interviews/questions";

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      ...EXT_CORS_HEADERS,
      "Access-Control-Allow-Methods": "PATCH, DELETE, OPTIONS",
    },
  });
}

export async function PATCH(
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
  const body = await request.json().catch(() => ({}));
  const prompt = typeof body.prompt === "string" ? body.prompt : "";

  const result = await updateQuestion(
    getAdminClient(),
    id,
    auth.userId,
    prompt,
  );

  return NextResponse.json(
    result.ok ? { ok: true } : { error: result.error },
    { status: result.ok ? 200 : 400, headers: EXT_CORS_HEADERS },
  );
}

export async function DELETE(
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
  const result = await deleteQuestion(getAdminClient(), id, auth.userId);
  return NextResponse.json(
    result.ok ? { ok: true } : { error: result.error },
    { status: result.ok ? 200 : 400, headers: EXT_CORS_HEADERS },
  );
}
