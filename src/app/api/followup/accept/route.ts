import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

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
    parentQuestionId?: string;
    prompt?: string;
  };
  const { interviewId, parentQuestionId, prompt } = body;

  if (!interviewId || !parentQuestionId || !prompt?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const { data: interview } = await supabase
    .from("interviews")
    .select("user_id")
    .eq("id", interviewId)
    .single<{ user_id: string }>();
  if (!interview || interview.user_id !== user.id) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  // Place the follow-up immediately after its parent.
  const { data: parent } = await supabase
    .from("questions")
    .select("position")
    .eq("id", parentQuestionId)
    .single<{ position: number }>();
  const insertPos = (parent?.position ?? 0) + 0.5; // fractional to slot in

  const { data: inserted, error } = await supabase
    .from("questions")
    .insert({
      interview_id: interviewId,
      position: insertPos,
      category: "followup",
      prompt: prompt.trim(),
      parent_question_id: parentQuestionId,
    })
    .select("id, position, category, difficulty, prompt")
    .single<{
      id: string;
      position: number;
      category: string;
      difficulty: string | null;
      prompt: string;
    }>();

  if (error || !inserted) {
    return NextResponse.json(
      { error: error?.message ?? "Insert failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ question: inserted });
}
