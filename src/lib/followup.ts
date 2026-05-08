import { groqChat, GROQ_LLM_SMART } from "@/lib/llm/groq-llm";
import { SENIORITY_LABELS, type Seniority } from "@/lib/types";

export type FollowupSuggestion = {
  askFollowup: boolean;
  prompt: string | null;
  reason: string;
};

const SYSTEM = `You are a senior hiring lead listening live to a screening interview.
After each candidate answer, you decide whether to probe with a follow-up question or move on.

Probe when:
- The answer is vague, evasive, or uses buzzwords without substance.
- The candidate makes a strong claim that demands evidence ("I led X", "I built Y from scratch").
- A specific, non-obvious resume claim was just touched on and needs verification.
- The answer reveals a more interesting thread worth pulling on.

Move on when:
- The answer was specific, evidenced, and reasonably complete.
- A follow-up would just be filler or a repeat.
- The original question was already answered well enough for a screening signal.

Output rules:
- Respond ONLY with JSON: { "askFollowup": boolean, "prompt": string|null, "reason": string }
- If askFollowup is false, prompt MUST be null.
- The follow-up prompt must be a single direct question (1-2 sentences, no preamble).
- "reason" is a short note for the interviewer (under 25 words) explaining the choice.`;

function truncate(s: string | null | undefined, max: number) {
  if (!s) return "";
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export async function suggestFollowup(input: {
  roleTitle: string;
  seniority: Seniority;
  jdText: string | null;
  resumeText: string | null;
  question: string;
  answer: string;
  priorFollowups?: string[];
}): Promise<FollowupSuggestion> {
  const userPrompt = [
    `Role: ${input.roleTitle}`,
    `Seniority: ${SENIORITY_LABELS[input.seniority]}`,
    input.jdText
      ? `JD highlights:\n${truncate(input.jdText, 1500)}`
      : "JD: (not supplied)",
    input.resumeText
      ? `Resume excerpt:\n${truncate(input.resumeText, 2000)}`
      : "Resume: (not supplied)",
    `\nOriginal question:\n${input.question}`,
    `\nCandidate answer (transcribed):\n${truncate(input.answer, 2500)}`,
    input.priorFollowups && input.priorFollowups.length
      ? `\nFollow-ups already asked on this question (do not repeat):\n- ${input.priorFollowups.join("\n- ")}`
      : "",
    "\nDecide: ask a follow-up or move on?",
  ]
    .filter(Boolean)
    .join("\n");

  const raw = await groqChat(
    [
      { role: "system", content: SYSTEM },
      { role: "user", content: userPrompt },
    ],
    { model: GROQ_LLM_SMART, temperature: 0.3, maxTokens: 256, jsonMode: true },
  );

  let parsed: Partial<FollowupSuggestion> & { prompt?: unknown };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Groq returned non-JSON follow-up response");
  }

  const askFollowup = Boolean(parsed.askFollowup);
  const prompt =
    askFollowup && typeof parsed.prompt === "string"
      ? parsed.prompt.trim()
      : null;
  const reason =
    typeof parsed.reason === "string" ? parsed.reason.trim() : "";

  if (askFollowup && !prompt) {
    return {
      askFollowup: false,
      prompt: null,
      reason: reason || "Model said yes but produced no question.",
    };
  }

  return { askFollowup, prompt, reason };
}
