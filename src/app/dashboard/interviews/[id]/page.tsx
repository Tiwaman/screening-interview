import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SENIORITY_LABELS, type Seniority } from "@/lib/types";
import { QuestionsPanel } from "./questions-panel";
import { DeleteInterviewButton } from "./delete-button";

export default async function InterviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: interview, error } = await supabase
    .from("interviews")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !interview) {
    notFound();
  }

  const { data: questionsRaw } = await supabase
    .from("questions")
    .select("id, position, category, difficulty, prompt, edited")
    .eq("interview_id", id)
    .neq("category", "followup")
    .order("position", { ascending: true });

  const questions = (questionsRaw ?? []).map((q) => ({
    id: q.id as string,
    position: q.position as number,
    category: q.category as string,
    difficulty: (q.difficulty as string | null) ?? null,
    prompt: q.prompt as string,
    edited: Boolean(q.edited),
  }));

  const resumeChars =
    typeof interview.resume_parsed?.charCount === "number"
      ? interview.resume_parsed.charCount
      : null;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="space-y-1">
        <Link
          href="/dashboard"
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← Back to interviews
        </Link>
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {interview.role_title}
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {SENIORITY_LABELS[interview.seniority as Seniority]} · status{" "}
              <span className="font-medium">{interview.status}</span>
            </p>
          </div>
          {questions.length > 0 && (
            <div className="flex items-center gap-2">
              <Link
                href={`/dashboard/interviews/${id}/live`}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                ▶ Start live
              </Link>
              <Link
                href={`/dashboard/interviews/${id}/report`}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Report
              </Link>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card label="Job description">
          {interview.jd_text ? (
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
              {interview.jd_text}
            </pre>
          ) : (
            <Empty>No JD provided.</Empty>
          )}
        </Card>

        <Card label="Resume">
          {resumeChars !== null ? (
            <p className="text-sm text-zinc-700 dark:text-zinc-300">
              Parsed {resumeChars.toLocaleString()} characters from{" "}
              {interview.resume_parsed?.source?.toUpperCase() ?? "file"}.
            </p>
          ) : (
            <Empty>No resume uploaded.</Empty>
          )}
        </Card>
      </div>

      <QuestionsPanel interviewId={id} questions={questions} />

      <div className="flex justify-end pt-4">
        <DeleteInterviewButton interviewId={id} />
      </div>
    </div>
  );
}

function Card({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm italic text-zinc-400 dark:text-zinc-500">
      {children}
    </p>
  );
}
