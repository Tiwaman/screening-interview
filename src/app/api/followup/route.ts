import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { suggestFollowup } from "@/lib/followup";
import type { Seniority } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    interviewId?: string;
    questionId?: string;
    answer?: string;
  };
  const { interviewId, questionId, answer } = body;

  if (!interviewId || !questionId || !answer || answer.trim().length < 8) {
    return NextResponse.json(
      { error: "Missing fields or answer too short" },
      { status: 400 },
    );
  }

  // Verify ownership and pull context.
  const { data: interview } = await supabase
    .from("interviews")
    .select("user_id, role_title, seniority, jd_text, resume_parsed")
    .eq("id", interviewId)
    .single<{
      user_id: string;
      role_title: string;
      seniority: string;
      jd_text: string | null;
      resume_parsed: { text?: string } | null;
    }>();
  if (!interview || interview.user_id !== user.id) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  const { data: question } = await supabase
    .from("questions")
    .select("prompt")
    .eq("id", questionId)
    .single<{ prompt: string }>();
  if (!question) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const { data: priorFollowupsData } = await supabase
    .from("questions")
    .select("prompt")
    .eq("interview_id", interviewId)
    .eq("parent_question_id", questionId)
    .order("created_at", { ascending: true });
  const priorFollowups = (priorFollowupsData ?? []).map(
    (q) => q.prompt as string,
  );

  try {
    const suggestion = await suggestFollowup({
      roleTitle: interview.role_title,
      seniority: interview.seniority as Seniority,
      jdText: interview.jd_text,
      resumeText: interview.resume_parsed?.text ?? null,
      question: question.prompt,
      answer,
      priorFollowups,
    });
    return NextResponse.json(suggestion);
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Follow-up generation failed.",
      },
      { status: 500 },
    );
  }
}
