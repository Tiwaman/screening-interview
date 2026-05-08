export const SENIORITY_VALUES = [
  "intern",
  "junior",
  "mid",
  "senior",
  "staff",
  "principal",
] as const;

export type Seniority = (typeof SENIORITY_VALUES)[number];

export const SENIORITY_LABELS: Record<Seniority, string> = {
  intern: "Intern",
  junior: "Junior",
  mid: "Mid-level",
  senior: "Senior",
  staff: "Staff",
  principal: "Principal",
};

export const INTERVIEW_STATUSES = [
  "draft",
  "ready",
  "live",
  "completed",
  "archived",
] as const;

export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export type ResumeParsed = {
  text: string;
  charCount: number;
  source: "pdf" | "docx" | "txt";
};

export type Interview = {
  id: string;
  user_id: string;
  role_title: string;
  seniority: Seniority;
  jd_text: string | null;
  resume_storage_path: string | null;
  resume_parsed: ResumeParsed | null;
  status: InterviewStatus;
  created_at: string;
  updated_at: string;
};
