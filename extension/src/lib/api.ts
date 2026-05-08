import { getApiBase, getToken } from "./storage";

export type InterviewSummary = {
  id: string;
  role_title: string;
  seniority: string;
  status: string;
  created_at: string;
};

export type Question = {
  id: string;
  position: number;
  category: string;
  difficulty: string | null;
  prompt: string;
  edited: boolean;
};

export type InterviewDetail = {
  interview: {
    id: string;
    role_title: string;
    seniority: string;
    status: string;
    created_at: string;
  };
  questions: Question[];
};

async function authHeader(): Promise<string> {
  const token = await getToken();
  if (!token) throw new Error("No token configured");
  return `Bearer ${token}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = await getApiBase();
  const auth = await authHeader();
  const headers: Record<string, string> = {
    Authorization: auth,
    ...((init?.headers as Record<string, string>) ?? {}),
  };
  if (init?.body && !(init.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body || "request failed"}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export function listInterviews() {
  return request<{ interviews: InterviewSummary[] }>("/api/extension/interviews");
}

export function getInterview(id: string) {
  return request<InterviewDetail>(`/api/extension/interviews/${id}`);
}

export function createInterview(input: {
  roleTitle: string;
  seniority: string;
  jdText: string;
  resume: File | null;
}) {
  const fd = new FormData();
  fd.set("role_title", input.roleTitle);
  fd.set("seniority", input.seniority);
  if (input.jdText) fd.set("jd_text", input.jdText);
  if (input.resume) fd.set("resume", input.resume);
  return request<{ id: string }>("/api/extension/interviews", {
    method: "POST",
    body: fd,
  });
}

export function generateQuestions(interviewId: string) {
  return request<{ ok: true }>(
    `/api/extension/interviews/${interviewId}/generate-questions`,
    { method: "POST" },
  );
}

export function updateQuestion(questionId: string, prompt: string) {
  return request<{ ok: true }>(`/api/extension/questions/${questionId}`, {
    method: "PATCH",
    body: JSON.stringify({ prompt }),
  });
}

export function deleteQuestion(questionId: string) {
  return request<{ ok: true }>(`/api/extension/questions/${questionId}`, {
    method: "DELETE",
  });
}

export function moveQuestion(questionId: string, direction: "up" | "down") {
  return request<{ ok: true }>(
    `/api/extension/questions/${questionId}/move`,
    {
      method: "POST",
      body: JSON.stringify({ direction }),
    },
  );
}
