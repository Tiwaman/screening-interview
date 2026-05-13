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
const SILENCE_TRIGGER_MS = 6000;
const MIN_ANSWER_LEN = 30;
const MATCH_CONFIDENCE_THRESHOLD = 0.65;

type Speaker = "candidate" | "interviewer";

type ChunkEntry = {
  text: string;
  speaker: Speaker;
  questionId: string | null;
  receivedAt: number;
  offScript?: boolean;
};

type Suggestion = {
  prompt: string;
  reason: string;
  forQuestionId: string;
};

type MatchResult = {
  matched_question_id: string | null;
  confidence: number;
  is_off_script: boolean;
  signaled_advance: boolean;
  reasoning: string;
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
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [micGranted, setMicGranted] = useState(false);
  const [advanceToast, setAdvanceToast] = useState<string | null>(null);

  const tts = useTts();
  const lastSpokenIdRef = useRef<string | null>(null);

  // Candidate (tab) capture
  const tabStreamRef = useRef<MediaStream | null>(null);
  const tabRecorderRef = useRef<MediaRecorder | null>(null);
  const tabChunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Interviewer (mic) capture
  const micStreamRef = useRef<MediaStream | null>(null);
  const micRecorderRef = useRef<MediaRecorder | null>(null);
  const micChunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const stoppingRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentQuestionIdRef = useRef<string | null>(
    initialQuestions[0]?.id ?? null,
  );
  const questionsRef = useRef<Question[]>(initialQuestions);
  const currentIdxRef = useRef(0);
  const autoAdvanceRef = useRef(autoAdvance);
  const lastMatchedRef = useRef<string | null>(null);

  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const lastEvaluatedAnswerRef = useRef<Record<string, string>>({});

  const current = questions[currentIdx];

  useEffect(() => {
    questionsRef.current = questions;
  }, [questions]);

  useEffect(() => {
    currentIdxRef.current = currentIdx;
    currentQuestionIdRef.current = current?.id ?? null;
    setSuggestion(null);
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
    autoAdvanceRef.current = autoAdvance;
  }, [autoAdvance]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chunks.length]);

  useEffect(() => {
    return () => stopCapture();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── End-of-answer detection (candidate only) ──────────────────────────
  useEffect(() => {
    if (!recording || !current) return;
    const lastCandidateChunk = [...chunks]
      .reverse()
      .find((c) => c.speaker === "candidate" && c.questionId === current.id);
    if (!lastCandidateChunk) return;

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      void maybeSuggestFollowup();
    }, SILENCE_TRIGGER_MS);

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunks, recording, current]);

  // ── Answer + follow-up suggestion ─────────────────────────────────────
  function answerForCurrent(): string {
    if (!current) return "";
    return chunks
      .filter((c) => c.speaker === "candidate" && c.questionId === current.id)
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
      if (!res.ok) return;
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
    } catch {
      /* swallow */
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

  // ── STT upload ────────────────────────────────────────────────────────
  async function uploadChunk(blob: Blob, speaker: Speaker) {
    if (blob.size < 1_000) return null;
    const fd = new FormData();
    fd.set("audio", blob, `chunk-${speaker}.webm`);
    fd.set("interview_id", interviewId);
    fd.set("speaker", speaker);
    const questionId =
      speaker === "candidate" ? currentQuestionIdRef.current : null;
    if (questionId) fd.set("question_id", questionId);

    try {
      const res = await fetch("/api/stt", { method: "POST", body: fd });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        setError(`STT ${res.status}: ${body || "request failed"}`);
        return null;
      }
      const data = (await res.json()) as { transcript?: string };
      return data.transcript ?? "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "STT request failed");
      return null;
    }
  }

  async function handleChunk(blob: Blob, speaker: Speaker) {
    const text = await uploadChunk(blob, speaker);
    if (!text) return;

    setChunks((prev) => {
      const lastForSpeaker = [...prev]
        .reverse()
        .find((c) => c.speaker === speaker);
      if (lastForSpeaker && lastForSpeaker.text === text) return prev;
      return [
        ...prev,
        {
          text,
          speaker,
          questionId:
            speaker === "candidate" ? currentQuestionIdRef.current : null,
          receivedAt: Date.now(),
        },
      ];
    });

    if (speaker === "interviewer") {
      void runMatcher(text);
    }
  }

  // ── Interviewer-to-question matcher + auto-advance ────────────────────
  async function runMatcher(snippet: string) {
    if (!autoAdvanceRef.current) return;
    if (snippet.length < 4) return;
    try {
      const res = await fetch("/api/interviewer-match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          interviewId,
          snippet,
          currentQuestionId: currentQuestionIdRef.current,
        }),
      });
      if (!res.ok) return;
      const result = (await res.json()) as MatchResult;

      if (result.is_off_script) {
        // Tag the most recent interviewer chunk as off-script
        setChunks((prev) => {
          const next = [...prev];
          for (let i = next.length - 1; i >= 0; i--) {
            if (next[i].speaker === "interviewer") {
              next[i] = { ...next[i], offScript: true };
              break;
            }
          }
          return next;
        });
        return;
      }

      if (
        result.matched_question_id &&
        result.confidence >= MATCH_CONFIDENCE_THRESHOLD &&
        result.matched_question_id !== currentQuestionIdRef.current &&
        result.matched_question_id !== lastMatchedRef.current
      ) {
        const qs = questionsRef.current;
        const targetIdx = qs.findIndex(
          (q) => q.id === result.matched_question_id,
        );
        if (targetIdx < 0) return;
        // Only advance forward unless explicitly signaled
        if (
          targetIdx <= currentIdxRef.current &&
          !result.signaled_advance
        ) {
          return;
        }
        lastMatchedRef.current = result.matched_question_id;
        setCurrentIdx(targetIdx);
        currentQuestionIdRef.current = qs[targetIdx].id;
        setAdvanceToast(`Q${targetIdx + 1} · ${qs[targetIdx].prompt.slice(0, 60)}${qs[targetIdx].prompt.length > 60 ? "…" : ""}`);
        setTimeout(() => setAdvanceToast(null), 3500);
      }
    } catch {
      /* matcher failures are non-fatal */
    }
  }

  // ── Capture lifecycle ─────────────────────────────────────────────────
  async function startCapture() {
    setError(null);
    setStarting(true);
    try {
      // 1. Mic (interviewer) — request first; it's a smaller commitment
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        setMicGranted(true);
      } catch (err) {
        setMicGranted(false);
        console.warn("[live] mic denied", err);
        setError(
          "Mic permission denied — auto-advance and off-script detection won't run. You can still capture candidate audio.",
        );
      }

      // 2. Tab (candidate)
      const tabStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      const tabAudio = tabStream.getAudioTracks();
      if (tabAudio.length === 0) {
        tabStream.getTracks().forEach((t) => t.stop());
        micStream?.getTracks().forEach((t) => t.stop());
        throw new Error(
          "No tab audio shared. Pick the meeting tab and tick 'Share tab audio'.",
        );
      }
      tabStream.getVideoTracks().forEach((t) => t.stop());
      const tabAudioStream = new MediaStream(tabAudio);

      // Pipe tab audio back to speakers so the call still plays normally.
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      ctx
        .createMediaStreamSource(tabAudioStream)
        .connect(ctx.destination);

      tabStreamRef.current = tabAudioStream;
      tabAudio.forEach((t) => (t.onended = () => stopCapture()));

      if (micStream) {
        micStreamRef.current = micStream;
        micStream
          .getAudioTracks()
          .forEach((t) => (t.onended = () => stopCapture()));
      }

      stoppingRef.current = false;
      setRecording(true);
      startTabChunkCycle();
      if (micStream) startMicChunkCycle();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to start capture",
      );
    } finally {
      setStarting(false);
    }
  }

  function startTabChunkCycle() {
    const stream = tabStreamRef.current;
    if (!stream || stoppingRef.current) return;
    const blobs: Blob[] = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: "audio/webm;codecs=opus",
    });
    tabRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) blobs.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(blobs, { type: "audio/webm;codecs=opus" });
      if (blob.size > 0) void handleChunk(blob, "candidate");
      if (!stoppingRef.current) startTabChunkCycle();
    };
    recorder.start();
    tabChunkTimerRef.current = setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, CHUNK_MS);
  }

  function startMicChunkCycle() {
    const stream = micStreamRef.current;
    if (!stream || stoppingRef.current) return;
    const blobs: Blob[] = [];
    const recorder = new MediaRecorder(stream, {
      mimeType: "audio/webm;codecs=opus",
    });
    micRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) blobs.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(blobs, { type: "audio/webm;codecs=opus" });
      if (blob.size > 0) void handleChunk(blob, "interviewer");
      if (!stoppingRef.current) startMicChunkCycle();
    };
    recorder.start();
    micChunkTimerRef.current = setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, CHUNK_MS);
  }

  function stopCapture() {
    stoppingRef.current = true;

    [tabChunkTimerRef, micChunkTimerRef, silenceTimerRef].forEach((ref) => {
      if (ref.current) {
        clearTimeout(ref.current);
        ref.current = null;
      }
    });

    [tabRecorderRef, micRecorderRef].forEach((ref) => {
      const r = ref.current;
      if (r && r.state !== "inactive") r.stop();
      ref.current = null;
    });

    tabStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    tabStreamRef.current = null;
    micStreamRef.current = null;

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

  // ── Derived ───────────────────────────────────────────────────────────
  const candidateChunksForCurrent = chunks.filter(
    (c) => c.speaker === "candidate" && current && c.questionId === current.id,
  );
  const transcriptText = candidateChunksForCurrent
    .map((c) => c.text)
    .join(" ");
  const answerLen = transcriptText.length;

  return (
    <div className="space-y-5">
      {advanceToast && (
        <div className="fixed left-1/2 top-6 z-50 -translate-x-1/2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-medium text-white shadow-lg">
          ↪ Auto-advanced: {advanceToast}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      {!recording && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="text-sm font-semibold">Start the live interview</h2>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
            <li>
              <span className="font-medium">Allow microphone</span> when
              prompted — the agent listens to your prompts and auto-advances
              the question card.
            </li>
            <li>
              Then pick your <span className="font-medium">meeting tab</span>{" "}
              in Chrome&apos;s share picker and{" "}
              <span className="font-medium">
                tick &ldquo;Share tab audio&rdquo;
              </span>{" "}
              to capture the candidate.
            </li>
            <li>
              Audio is transcribed live. Follow-ups surface in the margin.
            </li>
          </ol>
          <button
            type="button"
            disabled={starting}
            onClick={startCapture}
            className="mt-4 w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {starting ? "Waiting…" : "▶ Start sharing"}
          </button>
        </div>
      )}

      {recording && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[11px] dark:border-zinc-800 dark:bg-zinc-950">
          <span className="inline-flex items-center gap-1 text-emerald-600">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-600" />
            Candidate · capturing tab
          </span>
          <span
            className={`inline-flex items-center gap-1 ${
              micGranted ? "text-amber-600" : "text-zinc-400 line-through"
            }`}
          >
            <span
              className={`inline-block h-2 w-2 rounded-full ${
                micGranted ? "animate-pulse bg-amber-500" : "bg-zinc-400"
              }`}
            />
            Interviewer · {micGranted ? "mic on" : "mic off"}
          </span>
          {micGranted && (
            <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={autoAdvance}
                onChange={(e) => setAutoAdvance(e.target.checked)}
                className="rounded"
              />
              Auto-advance on my prompts
            </label>
          )}
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

      {/* Per-question candidate transcript */}
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Candidate&apos;s answer
          {recording && (
            <span className="inline-flex items-center gap-1 text-emerald-600">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-emerald-600" />
              live
            </span>
          )}
        </h3>
        <div className="max-h-72 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-4 text-sm leading-relaxed text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
          {transcriptText ? (
            <p className="whitespace-pre-wrap">{transcriptText}</p>
          ) : (
            <p className="italic text-zinc-400 dark:text-zinc-500">
              {recording
                ? "Listening for the candidate…"
                : "No transcript yet for this question."}
            </p>
          )}
        </div>
      </div>

      {/* Combined two-speaker stream */}
      {chunks.length > 0 && (
        <details className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Live transcript · both speakers ({chunks.length} chunks)
          </summary>
          <ul className="mt-3 space-y-2">
            {chunks.map((c, i) => (
              <li
                key={i}
                className={`rounded-md px-3 py-2 ${
                  c.speaker === "interviewer"
                    ? "border-l-2 border-amber-400 bg-amber-50/60 dark:bg-amber-950/40"
                    : "border-l-2 border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/40"
                }`}
              >
                <p className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-zinc-500">
                  <span
                    className={
                      c.speaker === "interviewer"
                        ? "font-semibold text-amber-700 dark:text-amber-300"
                        : "font-semibold text-emerald-700 dark:text-emerald-300"
                    }
                  >
                    {c.speaker}
                  </span>
                  <span>· {new Date(c.receivedAt).toLocaleTimeString()}</span>
                  {c.questionId && (
                    <span>
                      · Q
                      {questions.findIndex((q) => q.id === c.questionId) + 1}
                    </span>
                  )}
                  {c.offScript && (
                    <span className="ml-auto rounded-full bg-amber-200 px-1.5 py-0.5 text-[9px] font-semibold text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                      off-script
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
                  {c.text}
                </p>
              </li>
            ))}
            <div ref={transcriptEndRef} />
          </ul>
        </details>
      )}
    </div>
  );
}
