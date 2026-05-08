import { Type } from "@google/genai";
import { getGemini, GEMINI_FLASH } from "./gemini";
import { SENIORITY_LABELS, type Seniority } from "@/lib/types";

export type GeneratedQuestion = {
  category: "technical" | "behavioral" | "resume_probe" | "role_specific";
  difficulty: "easy" | "medium" | "hard";
  prompt: string;
  rationale: string;
};

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      minItems: "8",
      maxItems: "12",
      items: {
        type: Type.OBJECT,
        properties: {
          category: {
            type: Type.STRING,
            enum: ["technical", "behavioral", "resume_probe", "role_specific"],
          },
          difficulty: {
            type: Type.STRING,
            enum: ["easy", "medium", "hard"],
          },
          prompt: { type: Type.STRING },
          rationale: { type: Type.STRING },
        },
        required: ["category", "difficulty", "prompt", "rationale"],
        propertyOrdering: ["category", "difficulty", "prompt", "rationale"],
      },
    },
  },
  required: ["questions"],
} as const;

const SYSTEM_INSTRUCTION = `You are a hiring lead designing a 30-minute screening interview.
You craft questions that:
- Are specific to the role and seniority — never generic.
- Probe both technical depth AND communication / problem-solving signals.
- When a resume is supplied, include 1-2 "resume_probe" questions that verify a non-obvious claim or accomplishment.
- When a JD is supplied, include 1-2 "role_specific" questions targeting the highest-priority must-haves.
- Mix difficulty: at least one easy warm-up, several medium, and 1-2 hard / stretch questions.
- Avoid yes/no or trivia. Each prompt should invite a 1-3 minute answer.
- Each question gets a one-sentence rationale explaining what signal you are looking for.`;

function truncate(text: string | null | undefined, max: number) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "\n…[truncated]" : text;
}

export async function generateQuestions(input: {
  roleTitle: string;
  seniority: Seniority;
  jdText: string | null;
  resumeText: string | null;
}): Promise<GeneratedQuestion[]> {
  const ai = getGemini();

  const userPrompt = [
    `Role: ${input.roleTitle}`,
    `Seniority: ${SENIORITY_LABELS[input.seniority]}`,
    input.jdText
      ? `\n--- Job Description ---\n${truncate(input.jdText, 6000)}`
      : "\n(No job description supplied — infer typical responsibilities for this role + seniority.)",
    input.resumeText
      ? `\n--- Candidate Resume ---\n${truncate(input.resumeText, 8000)}`
      : "\n(No candidate resume supplied — design role-targeted questions for an unknown candidate.)",
    "\nReturn 8-12 screening questions following the schema. Order them so the interview flows naturally: warm-up first, deeper probes in the middle, stretch / closing question last.",
  ].join("\n");

  const response = await ai.models.generateContent({
    model: GEMINI_FLASH,
    contents: userPrompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.7,
    },
  });

  const raw = response.text;
  if (!raw) {
    throw new Error("Gemini returned an empty response");
  }

  let parsed: { questions?: GeneratedQuestion[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Gemini response was not valid JSON");
  }

  if (!parsed.questions || !Array.isArray(parsed.questions)) {
    throw new Error("Gemini response missing questions array");
  }

  return parsed.questions;
}
