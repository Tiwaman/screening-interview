import type { SupabaseClient } from "@supabase/supabase-js";
import { generateQuestions } from "@/lib/llm/generate-questions";
import type { Seniority } from "@/lib/types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = SupabaseClient<any, "public", "public", any, any>;

export type QuestionResult = { ok: true } | { ok: false; error: string };

type InterviewRow = {
  id: string;
  user_id: string;
  role_title: string;
  seniority: string;
  jd_text: string | null;
  resume_parsed: { text?: string } | null;
};

async function loadOwned(
  supabase: Sb,
  interviewId: string,
  userId: string,
): Promise<InterviewRow | { error: string }> {
  const { data, error } = await supabase
    .from("interviews")
    .select("id, user_id, role_title, seniority, jd_text, resume_parsed")
    .eq("id", interviewId)
    .single<InterviewRow>();

  if (error || !data) return { error: error?.message ?? "Not found." };
  if (data.user_id !== userId) return { error: "Forbidden." };
  return data;
}

export async function generateQuestionsForInterview(
  supabase: Sb,
  interviewId: string,
  userId: string,
): Promise<QuestionResult> {
  const interview = await loadOwned(supabase, interviewId, userId);
  if ("error" in interview) return { ok: false, error: interview.error };

  let generated;
  try {
    generated = await generateQuestions({
      roleTitle: interview.role_title,
      seniority: interview.seniority as Seniority,
      jdText: interview.jd_text,
      resumeText: interview.resume_parsed?.text ?? null,
    });
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Generation failed.",
    };
  }

  const { error: deleteErr } = await supabase
    .from("questions")
    .delete()
    .eq("interview_id", interviewId)
    .neq("category", "followup");
  if (deleteErr) return { ok: false, error: deleteErr.message };

  const rows = generated.map((q, i) => ({
    interview_id: interviewId,
    position: i + 1,
    category: q.category,
    difficulty: q.difficulty,
    prompt: q.prompt,
  }));

  const { error: insertErr } = await supabase.from("questions").insert(rows);
  if (insertErr) return { ok: false, error: insertErr.message };

  await supabase
    .from("interviews")
    .update({ status: "ready" })
    .eq("id", interviewId);

  return { ok: true };
}

async function loadQuestionInterviewId(
  supabase: Sb,
  questionId: string,
  userId: string,
): Promise<{ interviewId: string } | { error: string }> {
  const { data, error } = await supabase
    .from("questions")
    .select("id, interview_id, interviews!inner(user_id)")
    .eq("id", questionId)
    .single<{
      id: string;
      interview_id: string;
      interviews: { user_id: string };
    }>();

  if (error || !data) return { error: error?.message ?? "Not found." };
  if (data.interviews.user_id !== userId) return { error: "Forbidden." };
  return { interviewId: data.interview_id };
}

export async function updateQuestion(
  supabase: Sb,
  questionId: string,
  userId: string,
  prompt: string,
): Promise<QuestionResult> {
  const trimmed = prompt.trim();
  if (!trimmed) return { ok: false, error: "Question cannot be empty." };

  const ctx = await loadQuestionInterviewId(supabase, questionId, userId);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await supabase
    .from("questions")
    .update({ prompt: trimmed, edited: true })
    .eq("id", questionId);

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteQuestion(
  supabase: Sb,
  questionId: string,
  userId: string,
): Promise<QuestionResult> {
  const ctx = await loadQuestionInterviewId(supabase, questionId, userId);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { error } = await supabase
    .from("questions")
    .delete()
    .eq("id", questionId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function moveQuestion(
  supabase: Sb,
  questionId: string,
  userId: string,
  direction: "up" | "down",
): Promise<QuestionResult> {
  const ctx = await loadQuestionInterviewId(supabase, questionId, userId);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const { data: current, error: currErr } = await supabase
    .from("questions")
    .select("id, interview_id, position")
    .eq("id", questionId)
    .single<{ id: string; interview_id: string; position: number }>();
  if (currErr || !current) {
    return { ok: false, error: currErr?.message ?? "Question not found." };
  }

  const { data: neighbor } = await supabase
    .from("questions")
    .select("id, position")
    .eq("interview_id", current.interview_id)
    .order("position", { ascending: direction === "down" })
    .gt(
      "position",
      direction === "down" ? current.position : Number.MIN_SAFE_INTEGER,
    )
    .lt(
      "position",
      direction === "up" ? current.position : Number.MAX_SAFE_INTEGER,
    )
    .limit(1)
    .maybeSingle<{ id: string; position: number }>();

  if (!neighbor) return { ok: true };

  await supabase
    .from("questions")
    .update({ position: -1 })
    .eq("id", current.id);
  await supabase
    .from("questions")
    .update({ position: current.position })
    .eq("id", neighbor.id);
  await supabase
    .from("questions")
    .update({ position: neighbor.position })
    .eq("id", current.id);

  return { ok: true };
}
