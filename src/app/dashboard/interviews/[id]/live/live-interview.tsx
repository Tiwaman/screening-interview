"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTts } from "@/lib/use-tts";

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
const SILENCE_TRIGGER_MS = 6000; // after this much idle since last chunk, suggest a follow-up
const MIN_ANSWER_LEN = 30; // skip follow-up suggestion if answer is too short

type ChunkEntry = {
  text: string;
  questionId: string | null;
  receivedAt: number;
};

type Suggestion = {
  prompt: string;
  reason: string;
  forQuestionId: string;
};

export function LiveInterview({
  interviewId,
  questions: initialQuestions,
}: {
  interviewId: string;
  questions: Question[];
}) {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [recording, setRecording] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chunks, setChunks] = useState<ChunkEntry[]>([]);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [skippedFor, setSkippedFor] = useState<Set<string>>(new Set());
  const [generatingReport, setGeneratingReport] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const tts = useTts();
  const lastSpokenIdRef = useRef<string | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stoppingRef = useRef(false);
  const currentQuestionIdRef = useRef<string | null>(
    initialQuestions[0]?.id ?? null,
  );
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const lastEvaluatedAnswerRef = useRef<Record<string, string>>({});

  const current = questions[currentIdx];
  useEffect(() => {
    currentQuestionIdRef.current = current?.id ?? null;
    // Clear any stale suggestion when question changes.
    setSuggestion(null);
    // Auto-speak the new question when toggle is on.
    if (
      autoSpeak &&
      tts.supported &&
      current &&
      current.id !== lastSpokenIdRef.current
    ) {
      lastSpokenIdRef.current = current.id;
      tts.speak(current.prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, autoSpeak]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chunks.length]);

  useEffect(() => {
    return () => {
      stopCapture();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restart silence timer whenever a chunk arrives for the current question.
  useEffect(() => {
    if (!recording || !current) return;
    const lastChunk = chunks[chunks.length - 1];
    if (!lastChunk || lastChunk.questionId !== current.id) return;

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      void maybeSuggestFollowup();
    }, SILENCE_TRIGGER_MS);

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunks, recording, current]);

  function answerForCurrent(): string {
    if (!current) return "";
    return chunks
      .filter((c) => c.questionId === current.id)
      .map((c) => c.text)
      .join(" ")
      .trim();
  }

  async function maybeSuggestFollowup(force = false) {
    if (!current || suggesting) return;
    if (suggestion && suggestion.forQuestionId === current.id) return;
    if (skippedFor.has(current.id) && !force) return;

    const answer = answerForCurrent();
    if (answer.length < MIN_ANSWER_LEN) return;
    if (lastEvaluatedAnswerRef.current[current.id] === answer && !force) return;

    setSuggesting(true);
    lastEvaluatedAnswerRef.current[current.id] = answer;
    try {
      const res = await fetch("/api/followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId,
          questionId: current.id,
          answer,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        console.warn("[followup] error", res.status, body);
        return;
      }
      const data = (await res.json()) as {
        askFollowup: boolean;
        prompt: string | null;
        reason: string;
      };
      if (data.askFollowup && data.prompt) {
        setSuggestion({
          prompt: data.prompt,
          reason: data.reason,
          forQuestionId: current.id,
        });
      }
    } catch (err) {
      console.warn("[followup] failed", err);
    } finally {
      setSuggesting(false);
    }
  }

  async function acceptSuggestion() {
    if (!suggestion || !current) return;
    const parentId = suggestion.forQuestionId;
    const promptText = suggestion.prompt;
    setSuggestion(null);
    try {
      const res = await fetch("/api/followup/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId,
          parentQuestionId: parentId,
          prompt: promptText,
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        setError(`Follow-up insert ${res.status}: ${body}`);
        return;
      }
      const { question } = (await res.json()) as { question: Question };
      // Insert immediately after the parent in the local array, then jump to it.
      setQuestions((prev) => {
        const parentIdx = prev.findIndex((q) => q.id === parentId);
        if (parentIdx === -1) return [...prev, question];
        const next = [...prev];
        next.splice(parentIdx + 1, 0, question);
        return next;
      });
      setCurrentIdx((idx) => {
        const parentIdx = questions.findIndex((q) => q.id === parentId);
        return parentIdx === -1 ? idx : parentIdx + 1;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Follow-up insert failed");
    }
  }

  function skipSuggestion() {
    if (!suggestion) return;
    setSkippedFor((prev) => new Set(prev).add(suggestion.forQuestionId));
    setSuggestion(null);
  }

  async function uploadChunk(blob: Blob) {
    if (blob.size < 1_000) return;
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
    if (!consentGiven) {
      setError("Please confirm candidate consent before recording.");
      return;
    }
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
      stream.getVideoTracks().forEach((t) => t.stop());
      const audioStream = new MediaStream(audioTracks);

      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(audioStream);
      source.connect(ctx.destination);

      streamRef.current = audioStream;
      stoppingRef.current = false;

      audioTracks.forEach((track) => {
        track.onended = () => stopCapture();
      });

      setRecording(true);
      startChunkCycle();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start screen share",
      );
    } finally {
      setStarting(false);
    }
  }

  function startChunkCycle() {
    const stream = streamRef.current;
    if (!stream || stoppingRef.current) return;

    const blobs: Blob[] = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: "audio/webm;codecs=opus",
    });
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) blobs.push(event.data);
    };
    recorder.onerror = (e) => console.error("[stt] recorder error", e);
    recorder.onstop = () => {
      const blob = new Blob(blobs, { type: "audio/webm;codecs=opus" });
      if (blob.size > 0) void uploadChunk(blob);
      if (!stoppingRef.current) startChunkCycle();
    };

    recorder.start();
    chunkTimerRef.current = setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, CHUNK_MS);
  }

  function stopCapture() {
    stoppingRef.current = true;

    if (chunkTimerRef.current) {
      clearTimeout(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

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

  async function endAndGenerateReport() {
    setError(null);
    setGeneratingReport(true);
    stopCapture();
    try {
      const res = await fetch("/api/reports/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interviewId }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`${res.status}: ${body || "Generation failed"}`);
      }
      router.push(`/dashboard/interviews/${interviewId}/report`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report generation failed");
      setGeneratingReport(false);
    }
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
  const answerLen = transcriptText.length;

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
              Audio is captured locally, transcribed, and the agent suggests
              follow-ups in real time.
            </li>
          </ol>

          <label className="mt-4 flex cursor-pointer gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <input
              type="checkbox"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              I confirm the candidate has been informed and consents to having
              their answers recorded and transcribed by AI for evaluation
              purposes. (Required by law in many jurisdictions.)
            </span>
          </label>

          <button
            type="button"
            disabled={starting || !consentGiven}
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

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {tts.supported && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    tts.state === "speaking"
                      ? tts.stop()
                      : tts.speak(current.prompt)
                  }
                  className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  {tts.state === "speaking" ? "■ Stop voice" : "🔊 Ask aloud"}
                </button>
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400">
                  <input
                    type="checkbox"
                    checked={autoSpeak}
                    onChange={(e) => setAutoSpeak(e.target.checked)}
                    className="rounded"
                  />
                  Auto-speak on Next
                </label>
              </>
            )}
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
            <button
              type="button"
              disabled={suggesting || answerLen < MIN_ANSWER_LEN}
              onClick={() => void maybeSuggestFollowup(true)}
              className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              {suggesting ? "Thinking…" : "Suggest follow-up"}
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
            <button
              type="button"
              disabled={generatingReport}
              onClick={endAndGenerateReport}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {generatingReport ? "Generating…" : "End & generate report"}
            </button>
          </div>
        </div>
      )}

      {suggestion && current && suggestion.forQuestionId === current.id && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                Suggested follow-up
              </p>
              <p className="text-sm leading-relaxed text-zinc-900 dark:text-zinc-50">
                {suggestion.prompt}
              </p>
              {suggestion.reason && (
                <p className="text-[11px] italic text-amber-800 dark:text-amber-300">
                  {suggestion.reason}
                </p>
              )}
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={acceptSuggestion}
              className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
            >
              Ask this →
            </button>
            <button
              type="button"
              onClick={skipSuggestion}
              className="rounded-md border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-50 dark:border-amber-700 dark:bg-zinc-950 dark:text-amber-300 dark:hover:bg-zinc-900"
            >
              Skip
            </button>
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
