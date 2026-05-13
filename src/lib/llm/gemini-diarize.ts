import { Type } from "@google/genai";
import { getGemini, GEMINI_FLASH } from "./gemini";

export type DiarizedSegment = {
  speaker: "interviewer" | "candidate";
  text: string;
};

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    segments: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          speaker: {
            type: Type.STRING,
            enum: ["interviewer", "candidate"],
          },
          text: { type: Type.STRING },
        },
        required: ["speaker", "text"],
        propertyOrdering: ["speaker", "text"],
      },
    },
  },
  required: ["segments"],
} as const;

const SYSTEM_INSTRUCTION = `You are a speech transcription engine for a screening interview happening in the same room (one microphone, both voices on it).

Rules:
- Transcribe the audio verbatim. Never invent or pad text.
- Split the transcript by who is speaking. Two roles only: "interviewer" and "candidate".
- INTERVIEWER asks questions, redirects, says things like "tell me about", "moving on", "can you elaborate", "let's go to the next one".
- CANDIDATE answers, gives examples, says things like "in my last role", "the way I'd approach it", "I worked on", "I built", "we shipped".
- If a chunk contains only one speaker, return a single segment.
- If both voices speak, return them in chronological order as separate segments.
- If the audio is silent or unintelligible, return an empty segments array.
- Never include filler labels, quotation marks, or commentary in the text — just the spoken words.`;

const HALLUCINATION_PATTERNS = [
  /^thanks? for watching\.?$/i,
  /^thank you\.?$/i,
  /^you$/i,
  /^bye\.?$/i,
  /^\[?music\]?$/i,
  /^\[?applause\]?$/i,
  /^\.+$/,
];

export async function transcribeAndDiarize(
  audio: File | Blob,
): Promise<DiarizedSegment[]> {
  const buffer = await audio.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mimeType = (audio as File).type || "audio/webm";

  const ai = getGemini();
  const response = await ai.models.generateContent({
    model: GEMINI_FLASH,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType, data: base64 } },
          {
            text: "Transcribe and split by speaker per the system instruction.",
          },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0,
    },
  });

  const raw = response.text;
  if (!raw) return [];

  let parsed: { segments?: DiarizedSegment[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
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

  return segments;
}
