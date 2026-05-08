"use client";

import { useEffect, useRef, useState } from "react";

type Question = {
  id: string;
  position: number;
  category: string;
  difficulty: string | null;
  prompt: string;
};

const CATEGORY_LABEL: Record<string, string> = {
  technical: "Technical",
  behavioral: "Behavioral",
  resume_probe: "Resume probe",
  role_specific: "Role-specific",
  followup: "Follow-up",
};

const CHUNK_MS = 3000;

type ChunkEntry = {
  text: string;
  questionId: string | null;
  receivedAt: number;
};

export function LiveInterview({
  interviewId,
  questions,
}: {
  interviewId: string;
  questions: Question[];
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chunks, setChunks] = useState<ChunkEntry[]>([]);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentQuestionIdRef = useRef<string | null>(
    questions[0]?.id ?? null,
  );
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const current = questions[currentIdx];
  useEffect(() => {
    currentQuestionIdRef.current = current?.id ?? null;
  }, [current]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chunks.length]);

  useEffect(() => {
    return () => {
      stopCapture();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function uploadChunk(blob: Blob) {
    console.log("[stt] chunk", blob.size, "bytes", blob.type);
    if (blob.size < 1_000) {
      console.warn("[stt] chunk too small, skipping");
      return;
    }
    const fd = new FormData();
    fd.set("audio", blob, "chunk.webm");
    fd.set("interview_id", interviewId);
    if (currentQuestionIdRef.current) {
      fd.set("question_id", currentQuestionIdRef.current);
    }
    try {
      const res = await fetch("/api/stt", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        setError(`STT ${res.status}: ${body || "request failed"}`);
        return;
      }
      const data = (await res.json()) as { transcript?: string };
      if (data.transcript) {
        setChunks((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.text === data.transcript) return prev;
          return [
            ...prev,
            {
              text: data.transcript!,
              questionId: currentQuestionIdRef.current,
              receivedAt: Date.now(),
            },
          ];
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "STT request failed");
    }
  }

  async function startCapture() {
    setError(null);
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error(
          "No audio track shared. When the picker appears, choose a tab and check 'Share tab audio'.",
        );
      }
      // Drop video tracks — we only need audio.
      stream.getVideoTracks().forEach((t) => t.stop());
      const audioStream = new MediaStream(audioTracks);

      // Pipe audio back to speakers so the interviewer can still hear.
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(audioStream);
      source.connect(ctx.destination);

      console.log(
        "[stt] audio tracks:",
        audioTracks.map((t) => ({
          label: t.label,
          enabled: t.enabled,
          muted: t.muted,
          settings: t.getSettings(),
        })),
      );

      const recorder = new MediaRecorder(audioStream, {
        mimeType: "audio/webm;codecs=opus",
      });
      recorder.ondataavailable = (event) => {
        console.log(
          "[stt] dataavailable fired, size:",
          event.data?.size ?? 0,
        );
        if (event.data && event.data.size > 0) void uploadChunk(event.data);
      };
      recorder.onstart = () => console.log("[stt] recorder started");
      recorder.onerror = (e) => console.error("[stt] recorder error", e);
      recorder.onstop = () => {
        setRecording(false);
      };
      recorder.start(CHUNK_MS);

      // If the user stops sharing via Chrome's UI, our tracks end.
      audioTracks.forEach((track) => {
        track.onended = () => stopCapture();
      });

      streamRef.current = audioStream;
      recorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start screen share",
      );
    } finally {
      setStarting(false);
    }
  }

  function stopCapture() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    recorderRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;

    setRecording(false);
  }

  function handleNext() {
    const next = currentIdx + 1;
    if (next >= questions.length) {
      stopCapture();
      return;
    }
    setCurrentIdx(next);
    currentQuestionIdRef.current = questions[next].id;
  }

  function handlePrev() {
    if (currentIdx === 0) return;
    const prev = currentIdx - 1;
    setCurrentIdx(prev);
    currentQuestionIdRef.current = questions[prev].id;
  }

  const currentChunks = chunks.filter(
    (c) => current && c.questionId === current.id,
  );
  const transcriptText = currentChunks.map((c) => c.text).join(" ");

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {!recording && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold">Start by sharing the meeting tab</h2>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
            <li>
              Click <span className="font-medium">Start sharing</span> below.
            </li>
            <li>
              In Chrome&apos;s picker, select your meeting tab (Meet / Zoom /
              Teams).
            </li>
            <li>
              <span className="font-medium">
                Tick the &ldquo;Share tab audio&rdquo; checkbox
              </span>{" "}
              before clicking Share.
            </li>
            <li>
              Audio is captured locally, transcribed by the AI, and shown live
              below.
            </li>
          </ol>
          <button
            type="button"
            disabled={starting}
            onClick={startCapture}
            className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {starting ? "Waiting for tab share…" : "▶ Start sharing"}
          </button>
        </div>
      )}

      {current && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            <span>
              Question {currentIdx + 1} of {questions.length}
            </span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 capitalize text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {CATEGORY_LABEL[current.category] ?? current.category}
              {current.difficulty ? ` · ${current.difficulty}` : ""}
            </span>
          </div>
          <p className="mt-3 text-base leading-relaxed text-zinc-900 dark:text-zinc-50">
            {current.prompt}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentIdx === 0}
              className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              ‹ Previous
            </button>
            <button
              type="button"
              onClick={handleNext}
              className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Next ›
            </button>
            {recording && (
              <button
                type="button"
                onClick={stopCapture}
                className="ml-auto rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
              >
                ■ Stop
              </button>
            )}
          </div>
        </div>
      )}

      <div>
        <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Transcript
          {recording && (
            <span className="inline-flex items-center gap-1 text-emerald-600">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-600" />
              live
            </span>
          )}
        </h3>
        <div className="max-h-96 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-4 text-sm leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
          {transcriptText ? (
            <p className="whitespace-pre-wrap">{transcriptText}</p>
          ) : (
            <p className="italic text-zinc-400 dark:text-zinc-500">
              {recording
                ? "Listening… transcript will appear here every few seconds."
                : "No transcript yet for this question."}
            </p>
          )}
          <div ref={transcriptEndRef} />
        </div>
      </div>

      {chunks.length > 0 && (
        <details className="rounded-2xl border border-zinc-200 bg-white p-4 text-xs dark:border-zinc-800 dark:bg-zinc-950">
          <summary className="cursor-pointer font-medium text-zinc-700 dark:text-zinc-300">
            Full transcript history ({chunks.length} chunks)
          </summary>
          <ul className="mt-3 space-y-2">
            {chunks.map((c, i) => (
              <li
                key={i}
                className="rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-900"
              >
                <p className="text-[10px] uppercase tracking-wide text-zinc-400">
                  {questions.find((q) => q.id === c.questionId)
                    ? `Q${
                        questions.findIndex((q) => q.id === c.questionId) + 1
                      }`
                    : "—"}{" "}
                  · {new Date(c.receivedAt).toLocaleTimeString()}
                </p>
                <p className="mt-1 text-zinc-700 dark:text-zinc-300">
                  {c.text}
                </p>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
