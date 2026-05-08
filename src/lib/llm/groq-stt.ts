const GROQ_TRANSCRIPTIONS_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";

const GROQ_STT_MODEL = "whisper-large-v3-turbo";

// Common Whisper hallucination patterns on silence / non-speech.
const HALLUCINATION_PATTERNS = [
  /^thanks? for watching\.?$/i,
  /^thank you\.?$/i,
  /^you$/i,
  /^bye\.?$/i,
  /^\[?music\]?$/i,
  /^\[?applause\]?$/i,
  /^\[silence\]$/i,
  /^\.+$/,
];

export async function transcribeWithGroq(
  audio: File | Blob,
  fileName = "audio.webm",
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

  const fd = new FormData();
  fd.set("file", audio, fileName);
  fd.set("model", GROQ_STT_MODEL);
  fd.set("response_format", "json");
  fd.set("language", "en");
  fd.set("temperature", "0");

  const res = await fetch(GROQ_TRANSCRIPTIONS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Groq STT ${res.status}: ${body || "request failed"}`);
  }

  const data = (await res.json()) as { text?: string };
  const text = (data.text ?? "").trim();
  if (!text) return "";

  if (HALLUCINATION_PATTERNS.some((re) => re.test(text))) {
    return "";
  }

  return text;
}
