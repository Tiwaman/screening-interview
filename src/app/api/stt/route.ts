import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { transcribeWithGroq } from "@/lib/llm/groq-stt";
import {
  transcribeAndDiarizeWithGroq,
  type DiarizedSegment,
} from "@/lib/llm/groq-diarize";

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

  // ── SAME-ROOM: one mic, both voices, Groq diarization ───────────────
  if (mode === "same-room") {
    // Pull the previous speaker so the diarizer can prefer continuity.
    const { data: prev } = await supabase
      .from("transcripts")
      .select("speaker")
      .eq("interview_id", interviewId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ speaker: string }>();
    const previousSpeaker =
      prev?.speaker === "interviewer"
        ? ("interviewer" as const)
        : prev?.speaker === "candidate"
          ? ("candidate" as const)
          : null;

    let segments: DiarizedSegment[] = [];
    try {
      segments = await transcribeAndDiarizeWithGroq(audio, previousSpeaker);
    } catch (err) {
      return NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : "Diarization failed.",
        },
        { status: 500 },
      );
    }

    const persisted: DiarizedSegment[] = [];
    for (const seg of segments) {
      // Dedup vs last chunk for the same speaker.
      const { data: last } = await supabase
        .from("transcripts")
        .select("content")
        .eq("interview_id", interviewId)
        .eq("speaker", seg.speaker)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<{ content: string }>();
      if (last?.content?.trim() === seg.text) continue;

      await supabase.from("transcripts").insert({
        interview_id: interviewId,
        question_id: seg.speaker === "candidate" ? questionId : null,
        speaker: seg.speaker,
        content: seg.text,
        ended_at: new Date().toISOString(),
      });
      persisted.push(seg);
    }

    return NextResponse.json({
      mode: "same-room",
      segments: persisted,
      // backward-compat single string of *candidate-only* text for callers
      // that still read transcript directly
      transcript: persisted
        .filter((s) => s.speaker === "candidate")
        .map((s) => s.text)
        .join(" "),
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
