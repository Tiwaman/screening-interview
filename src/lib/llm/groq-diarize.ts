import { transcribeWithGroq } from "./groq-stt";
import { groqChat, GROQ_LLM_FAST } from "./groq-llm";

export type DiarizedSegment = {
  speaker: "interviewer" | "candidate";
  text: string;
};

const SYSTEM = `You split a transcript fragment from a screening interview into two speakers: INTERVIEWER and CANDIDATE.

Decision rules — apply in order:
1. If the utterance is a QUESTION, a redirect, or a signal of transition ("tell me about", "can you elaborate", "what about", "moving on", "next question", "let's switch gears", "alright, so", "great", "thanks for that"), it's INTERVIEWER.
2. If the utterance gives a SUBSTANTIVE ANSWER, an example, a claim about experience, or a description of how the speaker would do something ("in my last role", "I built", "we shipped", "the way I'd approach it", "for example", "what I'd do is"), it's CANDIDATE.
3. If a previous speaker is provided as context, prefer continuity — the candidate's answer usually spans multiple chunks and isn't interrupted every 5 seconds.
4. Acknowledgements like "mhm", "right", "got it" are typically the INTERVIEWER listening; if the previous speaker was CANDIDATE answering, they may also come from the candidate.

Output rules:
- A single chunk may contain only one speaker — return one segment.
- If two speakers clearly take turns, return them in chronological order.
- Never edit, summarize, or paraphrase. Copy verbatim from the transcript.
- If the transcript is silent / unintelligible / a known Whisper hallucination, return an empty array.

Output STRICT JSON only:
{ "segments": [{ "speaker": "interviewer" | "candidate", "text": string }, ...] }`;

const HALLUCINATION_PATTERNS = [
  /^thanks? for watching\.?$/i,
  /^thank you\.?$/i,
  /^you$/i,
  /^bye\.?$/i,
  /^\[?music\]?$/i,
  /^\[?applause\]?$/i,
  /^\.+$/,
];

export async function transcribeAndDiarizeWithGroq(
  audio: File | Blob,
  previousSpeaker: "interviewer" | "candidate" | null = null,
): Promise<DiarizedSegment[]> {
  // 1. Plain transcript from Whisper.
  const text = await transcribeWithGroq(audio, "chunk.webm");
  if (!text) return [];

  const contextHint = previousSpeaker
    ? `Previous chunk was attributed to: ${previousSpeaker.toUpperCase()}. Prefer continuity unless this fragment clearly belongs to the other speaker.`
    : "No prior context — decide from content alone.";

  // 2. Ask Llama to split by speaker.
  let raw: string;
  try {
    raw = await groqChat(
      [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `${contextHint}\n\nTranscript fragment:\n"${text}"\n\nSplit by speaker per the rules.`,
        },
      ],
      {
        model: GROQ_LLM_FAST,
        temperature: 0,
        maxTokens: 512,
        jsonMode: true,
      },
    );
  } catch {
    return [{ speaker: previousSpeaker ?? "candidate", text }];
  }

  let parsed: { segments?: DiarizedSegment[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [{ speaker: previousSpeaker ?? "candidate", text }];
  }

  const segments = (parsed.segments ?? [])
    .map((s) => ({
      speaker:
        s.speaker === "interviewer" || s.speaker === "candidate"
          ? s.speaker
          : "candidate",
      text: (s.text ?? "").trim(),
    }))
    .filter(
      (s): s is DiarizedSegment =>
        Boolean(s.text) &&
        !HALLUCINATION_PATTERNS.some((re) => re.test(s.text)),
    );

  if (segments.length === 0) {
    return [{ speaker: previousSpeaker ?? "candidate", text }];
  }
  return segments;
}
