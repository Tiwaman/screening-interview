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

async function authHeaders(): Promise<HeadersInit> {
  const token = await getToken();
  if (!token) throw new Error("No token configured");
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const base = await getApiBase();
  const headers = await authHeaders();
  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body || "request failed"}`);
  }
  return res.json() as Promise<T>;
}

export function listInterviews() {
  return request<{ interviews: InterviewSummary[] }>("/api/extension/interviews");
}

export function getInterview(id: string) {
  return request<InterviewDetail>(`/api/extension/interviews/${id}`);
}
