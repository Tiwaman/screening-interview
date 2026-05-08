"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  generateQuestionsForInterview,
  updateQuestion,
  deleteQuestion,
  moveQuestion,
} from "@/lib/interviews/questions";

export type ActionResult = { ok: true } | { ok: false; error: string };

type UserCtx =
  | { error: string }
  | { supabase: Awaited<ReturnType<typeof createClient>>; userId: string };

async function getUserId(): Promise<UserCtx> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  return { supabase, userId: user.id };
}

export async function generateQuestionsAction(
  interviewId: string,
): Promise<ActionResult> {
  const ctx = await getUserId();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const result = await generateQuestionsForInterview(
    ctx.supabase,
    interviewId,
    ctx.userId,
  );
  if (result.ok) {
    revalidatePath(`/dashboard/interviews/${interviewId}`);
    revalidatePath("/dashboard");
  }
  return result;
}

export async function updateQuestionAction(
  questionId: string,
  prompt: string,
): Promise<ActionResult> {
  const ctx = await getUserId();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const result = await updateQuestion(
    ctx.supabase,
    questionId,
    ctx.userId,
    prompt,
  );
  if (result.ok) revalidatePath("/dashboard", "layout");
  return result;
}

export async function deleteQuestionAction(
  questionId: string,
): Promise<ActionResult> {
  const ctx = await getUserId();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const result = await deleteQuestion(
    ctx.supabase,
    questionId,
    ctx.userId,
  );
  if (result.ok) revalidatePath("/dashboard", "layout");
  return result;
}

export async function moveQuestionAction(
  questionId: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  const ctx = await getUserId();
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const result = await moveQuestion(
    ctx.supabase,
    questionId,
    ctx.userId,
    direction,
  );
  if (result.ok) revalidatePath("/dashboard", "layout");
  return result;
}
