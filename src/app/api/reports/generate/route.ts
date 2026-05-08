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

  const { data: questions } = await supabase
    .from("questions")
    .select("id, position, prompt, category")
    .eq("interview_id", interviewId)
    .order("position", { ascending: true });

  if (!questions || questions.length === 0) {
    return NextResponse.json(
      { error: "No questions to score" },
      { status: 400 },
    );
  }

  const { data: transcripts } = await supabase
    .from("transcripts")
    .select("question_id, content, speaker, created_at")
    .eq("interview_id", interviewId)
    .eq("speaker", "candidate")
    .order("created_at", { ascending: true });

  const answersByQuestion = new Map<string, string[]>();
  (transcripts ?? []).forEach((t) => {
    const qid = (t.question_id as string | null) ?? "";
    if (!qid) return;
    if (!answersByQuestion.has(qid)) answersByQuestion.set(qid, []);
    answersByQuestion.get(qid)!.push((t.content as string) ?? "");
  });

  const qa = (questions as { id: string; prompt: string; category: string }[]).map(
    (q) => ({
      question: q.prompt,
      category: q.category,
      answer: (answersByQuestion.get(q.id) ?? []).join(" ").trim(),
    }),
  );

  let report;
  try {
    report = await generateReport({
      roleTitle: interview.role_title,
      seniority: interview.seniority as Seniority,
      jdText: interview.jd_text,
      resumeText: interview.resume_parsed?.text ?? null,
      qa,
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
