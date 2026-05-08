import { NextResponse } from "next/server";
import {
  authenticateExtensionRequest,
  EXT_CORS_HEADERS,
} from "@/lib/extension-auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { getGemini, GEMINI_FLASH } from "@/lib/llm/gemini";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function OPTIONS() {
  return new NextResponse(null, { headers: EXT_CORS_HEADERS });
}

export async function POST(request: Request) {
  const auth = await authenticateExtensionRequest(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status, headers: EXT_CORS_HEADERS },
    );
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
      { status: 400, headers: EXT_CORS_HEADERS },
    );
  }

  // Verify the interview belongs to the caller.
  const admin = getAdminClient();
  const { data: interview } = await admin
    .from("interviews")
    .select("user_id")
    .eq("id", interviewId)
    .single<{ user_id: string }>();
  if (!interview || interview.user_id !== auth.userId) {
    return NextResponse.json(
      { error: "Interview not found" },
      { status: 404, headers: EXT_CORS_HEADERS },
    );
  }

  // Send the audio to Gemini for transcription.
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
      { status: 500, headers: EXT_CORS_HEADERS },
    );
  }

  // Persist non-empty chunks.
  if (transcript) {
    await admin.from("transcripts").insert({
      interview_id: interviewId,
      question_id: questionId,
      speaker,
      content: transcript,
      ended_at: new Date().toISOString(),
    });
  }

  return NextResponse.json(
    { transcript },
    { headers: EXT_CORS_HEADERS },
  );
}
