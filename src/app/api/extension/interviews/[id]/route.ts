import { NextResponse } from "next/server";
import {
  authenticateExtensionRequest,
  EXT_CORS_HEADERS,
} from "@/lib/extension-auth";
import { getAdminClient } from "@/lib/supabase/admin";

export async function OPTIONS() {
  return new NextResponse(null, { headers: EXT_CORS_HEADERS });
}

export async function GET(
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

  type InterviewRow = {
    id: string;
    user_id: string;
    role_title: string;
    seniority: string;
    status: string;
    jd_text: string | null;
    resume_parsed: { text?: string; charCount?: number; source?: string } | null;
    created_at: string;
  };

  const { data: interview, error } = await admin
    .from("interviews")
    .select(
      "id, user_id, role_title, seniority, status, jd_text, resume_parsed, created_at",
    )
    .eq("id", id)
    .single<InterviewRow>();

  if (error || !interview) {
    return NextResponse.json(
      { error: error?.message ?? "Interview not found" },
      { status: 404, headers: EXT_CORS_HEADERS },
    );
  }

  if (interview.user_id !== auth.userId) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: EXT_CORS_HEADERS },
    );
  }

  const { data: questions } = await admin
    .from("questions")
    .select("id, position, category, difficulty, prompt, edited")
    .eq("interview_id", id)
    .neq("category", "followup")
    .order("position", { ascending: true });

  return NextResponse.json(
    {
      interview: {
        id: interview.id,
        role_title: interview.role_title,
        seniority: interview.seniority,
        status: interview.status,
        created_at: interview.created_at,
      },
      questions: questions ?? [],
    },
    { headers: EXT_CORS_HEADERS },
  );
}
