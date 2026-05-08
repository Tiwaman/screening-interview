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
              text: [
                "You are a strict speech-to-text engine. Transcribe the audio EXACTLY as spoken — no paraphrasing, no completion, no hallucination.",
                "Rules:",
                "- If the audio is silent, near-silent, music-only, or contains no clearly intelligible speech, return EXACTLY the empty string.",
                "- Never invent or guess words to fill silence.",
                "- Never repeat a phrase to pad output.",
                "- Output only the transcribed words. No quotes, labels, prefixes, or commentary.",
              ].join("\n"),
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

  // De-dupe: if this transcript is identical to the last chunk for the same
  // interview/question, drop it. Catches Gemini's classic repeat-loop on
  // short / silent chunks.
  if (transcript) {
    const { data: lastChunk } = await supabase
      .from("transcripts")
      .select("content")
      .eq("interview_id", interviewId)
      .eq("speaker", speaker)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ content: string }>();

    if (lastChunk?.content?.trim() === transcript) {
      return NextResponse.json({ transcript: "" });
    }

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
