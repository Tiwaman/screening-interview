"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { generateQuestions } from "@/lib/llm/generate-questions";
import type { Seniority } from "@/lib/types";

export type ActionResult = { ok: true } | { ok: false; error: string };

type LoadedInterview = {
  id: string;
  user_id: string;
  role_title: string;
  seniority: string;
  jd_text: string | null;
  resume_parsed: { text?: string; charCount?: number; source?: string } | null;
};

type LoadResult =
  | { error: string }
  | {
      supabase: Awaited<ReturnType<typeof createClient>>;
      interview: LoadedInterview;
    };

async function loadInterview(id: string): Promise<LoadResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: interview, error } = await supabase
    .from("interviews")
    .select("id, user_id, role_title, seniority, jd_text, resume_parsed")
    .eq("id", id)
    .single<LoadedInterview>();

  if (error || !interview) {
    return { error: error?.message ?? "Interview not found." };
  }
  if (interview.user_id !== user.id) {
    return { error: "Forbidden." };
  }
  return { supabase, interview };
}

export async function generateQuestionsAction(
  interviewId: string,
): Promise<ActionResult> {
  const ctx = await loadInterview(interviewId);
  if ("error" in ctx) return { ok: false, error: ctx.error };
  const { supabase, interview } = ctx;

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
      error:
        err instanceof Error ? err.message : "Question generation failed.",
    };
  }

  // Replace any existing non-followup questions with the new set.
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

  revalidatePath(`/dashboard/interviews/${interviewId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updateQuestionAction(
  questionId: string,
  prompt: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const trimmed = prompt.trim();
  if (!trimmed) return { ok: false, error: "Question cannot be empty." };

  const { data, error } = await supabase
    .from("questions")
    .update({ prompt: trimmed, edited: true })
    .eq("id", questionId)
    .select("interview_id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Update failed." };
  }
  revalidatePath(`/dashboard/interviews/${data.interview_id}`);
  return { ok: true };
}

export async function deleteQuestionAction(
  questionId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("questions")
    .select("interview_id")
    .eq("id", questionId)
    .single();

  const { error } = await supabase
    .from("questions")
    .delete()
    .eq("id", questionId);

  if (error) return { ok: false, error: error.message };
  if (existing?.interview_id) {
    revalidatePath(`/dashboard/interviews/${existing.interview_id}`);
  }
  return { ok: true };
}

export async function moveQuestionAction(
  questionId: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: current, error: currErr } = await supabase
    .from("questions")
    .select("id, interview_id, position")
    .eq("id", questionId)
    .single();

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
    .maybeSingle();

  if (!neighbor) return { ok: true };

  // Swap positions via a temporary slot to avoid unique-constraint issues if added later.
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

  revalidatePath(`/dashboard/interviews/${current.interview_id}`);
  return { ok: true };
}
