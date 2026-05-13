import { transcribeWithGroq } from "./groq-stt";
import { groqChat, GROQ_LLM_FAST } from "./groq-llm";

export type DiarizedSegment = {
  speaker: "interviewer" | "candidate";
  text: string;
};

const SYSTEM = `You split a transcript fragment from a screening interview into two speakers: INTERVIEWER and CANDIDATE.

Heuristics:
- INTERVIEWER asks questions, redirects, signals transitions ("tell me about", "can you elaborate", "moving on", "next question", "let's switch gears", "alright, so").
- CANDIDATE answers, gives concrete examples or claims, says things like "in my last role", "I built", "we shipped", "the way I'd approach it".
- A single chunk may contain only one speaker. Don't invent a second speaker if it isn't there.
- If both speakers are present, split on the natural turn boundaries and return them in order.
- Never edit, summarize, or paraphrase the text — copy each speaker's words verbatim from the transcript.
- If the transcript is too short, silent, or unintelligible, return an empty array.

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
): Promise<DiarizedSegment[]> {
  // 1. Plain transcript from Whisper.
  const text = await transcribeWithGroq(audio, "chunk.webm");
  if (!text) return [];

  // 2. Ask Llama to split by speaker. Fast model is plenty for this.
  let raw: string;
  try {
    raw = await groqChat(
      [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Transcript fragment:\n"${text}"\n\nSplit by speaker per the rules.`,
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
    // Fall back: attribute the whole chunk to candidate (most likely speaker
    // by chunk length) so we don't lose the transcript entirely.
    return [{ speaker: "candidate", text }];
  }

  let parsed: { segments?: DiarizedSegment[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [{ speaker: "candidate", text }];
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

  // If splitting failed somehow (empty array), preserve the raw transcript.
  if (segments.length === 0) {
    return [{ speaker: "candidate", text }];
  }

  return segments;
}
