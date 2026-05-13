import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transcribeWithGroq } from "@/lib/llm/groq-stt";

type Segment = {
  speaker: "interviewer" | "candidate";
  text: string;
};

export const runtime = "nodejs";
export const maxDuration = 30;

type Mode = "remote" | "same-room";

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
  const mode: Mode =
    (formData.get("mode") as string | null) === "same-room"
      ? "same-room"
      : "remote";

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

  // ── SAME-ROOM: one mic carrying both voices. We do NOT try to split
  // speakers — diarization from a single mic without acoustic fingerprints
  // is unreliable and produces worse reports than just storing the whole
  // stream and letting the report LLM analyze it holistically (the prompt
  // already handles question↔answer mapping from raw content).
  if (mode === "same-room") {
    let transcript = "";
    try {
      transcript = await transcribeWithGroq(audio, audio.name || "audio.webm");
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : "Transcription failed.",
        },
        { status: 500 },
      );
    }
    if (!transcript) {
      return NextResponse.json({
        mode: "same-room",
        transcript: "",
        segments: [],
      });
    }

    // Dedup vs the most recent chunk regardless of speaker tag.
    const { data: last } = await supabase
      .from("transcripts")
      .select("content")
      .eq("interview_id", interviewId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ content: string }>();
    if (last?.content?.trim() === transcript) {
      return NextResponse.json({
        mode: "same-room",
        transcript: "",
        segments: [],
      });
    }

    // Save as a single row associated with the active question. We use
    // speaker='candidate' so the existing schema check passes; the report
    // prompt is explicitly told that same-room transcripts mix both voices
    // and to use content (not the label) to attribute statements.
    await supabase.from("transcripts").insert({
      interview_id: interviewId,
      question_id: questionId,
      speaker: "candidate",
      content: transcript,
      ended_at: new Date().toISOString(),
    });

    const seg: Segment = { speaker: "candidate", text: transcript };
    return NextResponse.json({
      mode: "same-room",
      transcript,
      segments: [seg],
    });
  }

  // ── REMOTE: speaker provided by caller, Groq Whisper, single segment ─
  let transcript = "";
  try {
    transcript = await transcribeWithGroq(audio, audio.name || "audio.webm");
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
    const { data: last } = await supabase
      .from("transcripts")
      .select("content")
      .eq("interview_id", interviewId)
      .eq("speaker", speaker)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ content: string }>();
    if (last?.content?.trim() === transcript) {
      return NextResponse.json({
        mode: "remote",
        transcript: "",
        segments: [],
      });
    }
    await supabase.from("transcripts").insert({
      interview_id: interviewId,
      question_id: speaker === "candidate" ? questionId : null,
      speaker,
      content: transcript,
      ended_at: new Date().toISOString(),
    });
  }

  return NextResponse.json({
    mode: "remote",
    transcript,
    segments: transcript ? [{ speaker, text: transcript }] : [],
  });
}
