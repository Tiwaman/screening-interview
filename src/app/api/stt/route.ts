import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGemini, GEMINI_FLASH } from "@/lib/llm/gemini";

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

  const formData = await request.formData();
  const audio = formData.get("audio") as File | null;
  const interviewId = formData.get("interview_id") as string | null;
  const questionId = (formData.get("question_id") as string | null) || null;
  const speaker =
    (formData.get("speaker") as string | null) === "interviewer"
      ? "interviewer"
      : "candidate";

  if (!audio || !interviewId) {
    return NextResponse.json(
      { error: "Missing audio or interview_id" },
      { status: 400 },
    );
  }

  const { data: interview } = await supabase
    .from("interviews")
    .select("user_id")
    .eq("id", interviewId)
    .single<{ user_id: string }>();
  if (!interview || interview.user_id !== user.id) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  const buffer = await audio.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mimeType = audio.type || "audio/webm";

  let transcript = "";
  try {
    const ai = getGemini();
    const response = await ai.models.generateContent({
      model: GEMINI_FLASH,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64 } },
            {
              text: "Transcribe this audio verbatim. Return only the spoken text — no preamble, no labels, no quotes. If silent or unintelligible, return an empty string.",
            },
          ],
        },
      ],
      config: { temperature: 0 },
    });
    transcript = (response.text ?? "").trim();
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Transcription failed.",
      },
      { status: 500 },
    );
  }

  if (transcript) {
    await supabase.from("transcripts").insert({
      interview_id: interviewId,
      question_id: questionId,
      speaker,
      content: transcript,
      ended_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({ transcript });
}
