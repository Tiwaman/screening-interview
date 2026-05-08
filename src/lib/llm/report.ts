import { Type } from "@google/genai";
import { getGemini, GEMINI_FLASH } from "./gemini";
import { SENIORITY_LABELS, type Seniority } from "@/lib/types";

export const REPORT_DIMENSIONS = [
  "technical_depth",
  "communication",
  "problem_solving",
  "attitude",
  "role_alignment",
  "authenticity",
] as const;

export type ReportDimension = (typeof REPORT_DIMENSIONS)[number];

export const DIMENSION_LABEL: Record<ReportDimension, string> = {
  technical_depth: "Technical depth",
  communication: "Communication",
  problem_solving: "Problem solving",
  attitude: "Attitude & ownership",
  role_alignment: "Role alignment",
  authenticity: "Authenticity",
};

export const DIMENSION_DESCRIPTION: Record<ReportDimension, string> = {
  technical_depth:
    "Accuracy, specificity, and depth of technical answers. Penalize buzzwords without substance.",
  communication:
    "Clarity, structure, conciseness. Reward concrete examples and STAR-like framing.",
  problem_solving:
    "How the candidate reasons through ambiguity and decomposes problems out loud.",
  attitude:
    "Ownership signals, curiosity, accountability. Watch for blame patterns or evasion.",
  role_alignment:
    "Fit against the JD must-haves and the seniority bar. If JD missing, infer typical expectations.",
  authenticity:
    "Did follow-up probing corroborate resume claims? Penalize contradictions or vague claims under pressure.",
};

export type DimensionScore = {
  value: number; // 1-5
  evidence: string[]; // direct quotes from the transcript
};

export type GeneratedReport = {
  scores: Record<ReportDimension, DimensionScore>;
  strengths: string[];
  concerns: string[];
  red_flags: string[];
  summary: string;
  hire_recommendation:
    | "strong_hire"
    | "hire"
    | "lean_hire"
    | "no_hire"
    | "strong_no_hire";
  confidence: number; // 0-1
};

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    scores: {
      type: Type.OBJECT,
      properties: REPORT_DIMENSIONS.reduce(
        (acc, dim) => ({
          ...acc,
          [dim]: {
            type: Type.OBJECT,
            properties: {
              value: { type: Type.INTEGER, minimum: 1, maximum: 5 },
              evidence: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                minItems: "0",
                maxItems: "3",
              },
            },
            required: ["value", "evidence"],
            propertyOrdering: ["value", "evidence"],
          },
        }),
        {} as Record<string, unknown>,
      ),
      required: [...REPORT_DIMENSIONS],
      propertyOrdering: [...REPORT_DIMENSIONS],
    },
    strengths: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      minItems: "0",
      maxItems: "5",
    },
    concerns: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      minItems: "0",
      maxItems: "5",
    },
    red_flags: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      minItems: "0",
      maxItems: "5",
    },
    summary: { type: Type.STRING },
    hire_recommendation: {
      type: Type.STRING,
      enum: [
        "strong_hire",
        "hire",
        "lean_hire",
        "no_hire",
        "strong_no_hire",
      ],
    },
    confidence: { type: Type.NUMBER, minimum: 0, maximum: 1 },
  },
  required: [
    "scores",
    "strengths",
    "concerns",
    "red_flags",
    "summary",
    "hire_recommendation",
    "confidence",
  ],
} as const;

const SYSTEM_INSTRUCTION = `You are a hiring lead writing a candid screening interview report.

Scoring rubric (1-5 per dimension):
- 1: Strong concern. Multiple specific failures.
- 2: Below the bar for this seniority.
- 3: Meets the bar. Acceptable but unremarkable.
- 4: Above the bar. Multiple strong signals.
- 5: Exceptional. Rare, high-confidence "yes".

Evidence rules:
- Each evidence string MUST be a verbatim or near-verbatim quote from the candidate's transcript.
- Maximum 3 quotes per dimension; quotes must each be under 30 words.
- If no clear evidence exists for a dimension, return value 3 with an empty evidence array and explain via concerns.

Hire recommendation aligns to the average score and the strongest signals — not a strict mean. Trust strong red flags.

Be honest. Don't pad. Don't invent quotes. Don't hedge.`;

function truncate(text: string | null | undefined, max: number) {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "\n…[truncated]" : text;
}

export type ReportInput = {
  roleTitle: string;
  seniority: Seniority;
  jdText: string | null;
  resumeText: string | null;
  qa: Array<{
    question: string;
    category: string;
    answer: string;
  }>;
};

export async function generateReport(input: ReportInput): Promise<GeneratedReport> {
  const ai = getGemini();

  const dimensionsBlock = REPORT_DIMENSIONS.map(
    (d) => `- **${DIMENSION_LABEL[d]}** (${d}): ${DIMENSION_DESCRIPTION[d]}`,
  ).join("\n");

  const transcriptBlock = input.qa
    .map(
      (qa, i) =>
        `## Q${i + 1} [${qa.category}]\n${qa.question}\n\n**Candidate answer:**\n${truncate(qa.answer || "(no transcript captured)", 1500)}`,
    )
    .join("\n\n");

  const userPrompt = [
    `Role: ${input.roleTitle}`,
    `Seniority: ${SENIORITY_LABELS[input.seniority]}`,
    input.jdText
      ? `\n## JD\n${truncate(input.jdText, 4000)}`
      : "\nJD: (not supplied — infer typical expectations for the role and seniority)",
    input.resumeText
      ? `\n## Resume excerpt\n${truncate(input.resumeText, 4000)}`
      : "\nResume: (not supplied)",
    `\n## Dimensions to score\n${dimensionsBlock}`,
    `\n## Interview transcript\n${transcriptBlock}`,
    `\nProduce the report following the schema. Be specific and concrete.`,
  ].join("\n");

  const response = await ai.models.generateContent({
    model: GEMINI_FLASH,
    contents: userPrompt,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.3,
    },
  });

  const raw = response.text;
  if (!raw) throw new Error("Gemini returned empty response");

  let parsed: GeneratedReport;
  try {
    parsed = JSON.parse(raw) as GeneratedReport;
  } catch {
    throw new Error("Gemini response was not valid JSON");
  }

  return parsed;
}

export const HIRE_LABEL: Record<
  GeneratedReport["hire_recommendation"],
  string
> = {
  strong_hire: "Strong hire",
  hire: "Hire",
  lean_hire: "Lean hire",
  no_hire: "No hire",
  strong_no_hire: "Strong no hire",
};

export const HIRE_TONE: Record<GeneratedReport["hire_recommendation"], string> = {
  strong_hire:
    "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800",
  hire: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-900",
  lean_hire:
    "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-900",
  no_hire: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-200 dark:border-red-900",
  strong_no_hire:
    "bg-red-100 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-800",
};
