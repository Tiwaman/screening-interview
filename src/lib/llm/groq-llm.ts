const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

export const GROQ_LLM_FAST = "llama-3.1-8b-instant";
export const GROQ_LLM_SMART = "llama-3.3-70b-versatile";

type Message = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
};

export async function groqChat(
  messages: Message[],
  options: ChatOptions = {},
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured");

  const body: Record<string, unknown> = {
    model: options.model ?? GROQ_LLM_SMART,
    messages,
    temperature: options.temperature ?? 0.4,
    max_tokens: options.maxTokens ?? 512,
  };
  if (options.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const res = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Groq chat ${res.status}: ${text || "request failed"}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Groq chat returned empty content");
  return content;
}
