import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { groqChat, GROQ_LLM_FAST } from "@/lib/llm/groq-llm";

export const runtime = "nodejs";
export const maxDuration = 15;

type QuestionLite = { id: string; position: number; prompt: string };

type MatchResult = {
  matched_question_id: string | null;
  confidence: number;
  is_off_script: boolean;
  signaled_advance: boolean; // explicit "next question" / "moving on" cue
  reasoning: string;
};

const SYSTEM = `You listen to an interviewer's speech in real time and decide which prepared question they are currently asking.

You receive:
- A short snippet of the interviewer's transcribed speech (may be partial or fragmentary).
- A numbered list of the prepared questions, with the current question marked.

Decide:
1. Did the interviewer just ask one of the prepared questions, in any wording? Return its id.
2. Are they signaling a transition ("moving on", "next question", "alright so...") even without quoting the prompt verbatim? Set signaled_advance=true and pick the next question forward.
3. Are they asking something not in the list? is_off_script=true, matched_question_id=null.
4. Are they not asking anything (filler, acknowledgement, "okay", "got it")? Return matched_question_id=null and is_off_script=false with low confidence.

Output STRICT JSON:
{
  "matched_question_id": string | null,
  "confidence": 0..1,
  "is_off_script": boolean,
  "signaled_advance": boolean,
  "reasoning": string (under 20 words)
}

Be conservative. Only match a question if the snippet clearly references its intent, topic, or wording. Default to null with low confidence when uncertain.`;

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
    snippet?: string;
    currentQuestionId?: string | null;
  };
  const { interviewId, snippet, currentQuestionId } = body;

  if (!interviewId || !snippet || snippet.trim().length < 3) {
    return NextResponse.json(
      { error: "Missing fields or snippet too short" },
      { status: 400 },
    );
  }

  // Ownership + question fetch.
  const { data: interview } = await supabase
    .from("interviews")
    .select("user_id")
    .eq("id", interviewId)
    .single<{ user_id: string }>();
  if (!interview || interview.user_id !== user.id) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  const { data: questionsRaw } = await supabase
    .from("questions")
    .select("id, position, prompt")
    .eq("interview_id", interviewId)
    .order("position", { ascending: true });

  const questions = (questionsRaw ?? []) as QuestionLite[];
  if (questions.length === 0) {
    return NextResponse.json({
      matched_question_id: null,
      confidence: 0,
      is_off_script: false,
      signaled_advance: false,
      reasoning: "No questions prepared.",
    } satisfies MatchResult);
  }

  const list = questions
    .map(
      (q, i) =>
        `${i + 1}. [id=${q.id}${q.id === currentQuestionId ? " · CURRENT" : ""}] ${q.prompt}`,
    )
    .join("\n");

  const userPrompt = [
    `Prepared questions (current marked):\n${list}`,
    `\nInterviewer just said:\n"${snippet.trim()}"`,
    `\nClassify this snippet against the prepared list per the rules.`,
  ].join("\n");

  let raw: string;
  try {
    raw = await groqChat(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt },
      ],
      {
        model: GROQ_LLM_FAST,
        temperature: 0.1,
        maxTokens: 256,
        jsonMode: true,
      },
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Matcher failed" },
      { status: 500 },
    );
  }

  let parsed: Partial<MatchResult>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "Matcher returned non-JSON" },
      { status: 500 },
    );
  }

  // Sanitize — only allow question ids that actually exist in this interview.
  const validIds = new Set(questions.map((q) => q.id));
  const matchedId =
    typeof parsed.matched_question_id === "string" &&
    validIds.has(parsed.matched_question_id)
      ? parsed.matched_question_id
      : null;

  const result: MatchResult = {
    matched_question_id: matchedId,
    confidence:
      typeof parsed.confidence === "number"
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0,
    is_off_script: Boolean(parsed.is_off_script) && !matchedId,
    signaled_advance: Boolean(parsed.signaled_advance),
    reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
  };

  return NextResponse.json(result);
}
