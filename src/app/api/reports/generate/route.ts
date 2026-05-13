import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateReport } from "@/lib/llm/report";
import type { Seniority } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  };
  const { interviewId } = body;
  if (!interviewId) {
    return NextResponse.json({ error: "Missing interviewId" }, { status: 400 });
  }

  const { data: interview } = await supabase
    .from("interviews")
    .select("id, user_id, role_title, seniority, jd_text, resume_parsed")
    .eq("id", interviewId)
    .single<{
      id: string;
      user_id: string;
      role_title: string;
      seniority: string;
      jd_text: string | null;
      resume_parsed: { text?: string } | null;
    }>();
  if (!interview || interview.user_id !== user.id) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  const { data: questionsRaw } = await supabase
    .from("questions")
    .select("id, position, prompt, category")
    .eq("interview_id", interviewId)
    .order("position", { ascending: true });

  const questions = (questionsRaw ?? []) as Array<{
    id: string;
    position: number;
    prompt: string;
    category: string;
  }>;

  if (questions.length === 0) {
    return NextResponse.json(
      { error: "No questions to score" },
      { status: 400 },
    );
  }

  // Pull EVERY transcript chunk in chronological order, regardless of speaker
  // tag. The LLM is asked to re-map content to questions and to trust content
  // over labels — this makes us resilient to mislabeled chunks from same-room
  // diarization or mis-clicked Next buttons.
  const { data: transcripts } = await supabase
    .from("transcripts")
    .select("question_id, content, speaker, created_at")
    .eq("interview_id", interviewId)
    .order("created_at", { ascending: true });

  const qPosById = new Map<string, number>();
  questions.forEach((q) => qPosById.set(q.id, q.position));

  const transcriptLog = (transcripts ?? [])
    .map((t) => {
      const content = ((t.content as string) ?? "").trim();
      if (!content) return null;
      const qid = (t.question_id as string | null) ?? null;
      return {
        speaker:
          (t.speaker as string) === "interviewer"
            ? ("interviewer" as const)
            : ("candidate" as const),
        content,
        question_id: qid,
        questionPosition: qid ? (qPosById.get(qid) ?? null) : null,
      };
    })
    .filter(
      (
        x,
      ): x is {
        speaker: "interviewer" | "candidate";
        content: string;
        question_id: string | null;
        questionPosition: number | null;
      } => x !== null,
    );

  let report;
  try {
    report = await generateReport({
      roleTitle: interview.role_title,
      seniority: interview.seniority as Seniority,
      jdText: interview.jd_text,
      resumeText: interview.resume_parsed?.text ?? null,
      questions: questions.map((q) => ({
        position: q.position,
        prompt: q.prompt,
        category: q.category,
      })),
      transcriptLog,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Report generation failed.",
      },
      { status: 500 },
    );
  }

  // Upsert the report row.
  const reportPayload = {
    interview_id: interviewId,
    scores: {
      dimensions: report.scores,
      strengths: report.strengths,
      concerns: report.concerns,
      red_flags: report.red_flags,
    },
    summary: report.summary,
    hire_recommendation: report.hire_recommendation,
    confidence: report.confidence,
  };

  const { error: upsertErr } = await supabase
    .from("reports")
    .upsert(reportPayload, { onConflict: "interview_id" });

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  await supabase
    .from("interviews")
    .update({ status: "completed" })
    .eq("id", interviewId);

  return NextResponse.json({ ok: true });
}
