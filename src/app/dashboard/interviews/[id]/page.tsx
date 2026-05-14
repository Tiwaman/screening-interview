import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SENIORITY_LABELS, type Seniority } from "@/lib/types";
import { QuestionsPanel } from "./questions-panel";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  ready: "Ready",
  live: "Live",
  completed: "Completed",
  archived: "Archived",
};

const STATUS_TONE: Record<string, string> = {
  draft: "text-ink-muted",
  ready: "text-emerald-grove",
  live: "text-accent",
  completed: "text-ink-soft",
  archived: "text-ink-muted/70",
};

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

  if (error || !interview) notFound();

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
    <div className="space-y-10">
      <header className="space-y-6 border-b border-rule pb-8">
        <Link
          href="/dashboard"
          className="text-[12px] text-ink-muted ink-link"
        >
          ← Back to interviews
        </Link>

        <div className="grid grid-cols-12 items-end gap-6">
          <div className="col-span-12 lg:col-span-8">
            <p className="eyebrow">
              {SENIORITY_LABELS[interview.seniority as Seniority]} ·{" "}
              <span className={STATUS_TONE[interview.status] ?? ""}>
                {STATUS_LABEL[interview.status] ?? interview.status}
              </span>
            </p>
            <h1 className="mt-3 font-display text-[56px] leading-[0.95] tracking-tight">
              {interview.role_title}
            </h1>
          </div>
          {questions.length > 0 && (
            <div className="col-span-12 flex items-center gap-3 lg:col-span-4 lg:justify-end">
              <Link
                href={`/dashboard/interviews/${id}/report`}
                className="border border-rule px-4 py-2 text-[13px] font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink"
              >
                Report
              </Link>
              <Link
                href={`/dashboard/interviews/${id}/live`}
                className="border border-ink bg-ink px-5 py-2.5 text-[13px] font-medium text-canvas transition-colors hover:bg-accent hover:border-accent"
              >
                ▶ Start live
              </Link>
            </div>
          )}
        </div>
      </header>

      <section className="grid grid-cols-12 gap-8">
        <div className="col-span-12 sm:col-span-7">
          <p className="eyebrow">Job description</p>
          <div className="mt-3 border-l-2 border-rule pl-4">
            {interview.jd_text ? (
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap font-sans text-[13px] leading-relaxed text-ink-soft">
                {interview.jd_text}
              </pre>
            ) : (
              <p className="text-[13px] italic text-ink-muted">
                No JD provided.
              </p>
            )}
          </div>
        </div>

        <div className="col-span-12 sm:col-span-5">
          <p className="eyebrow">Resume</p>
          <div className="mt-3 border-l-2 border-rule pl-4">
            {resumeChars !== null ? (
              <p className="text-[13px] leading-relaxed text-ink-soft">
                Parsed{" "}
                <span className="font-mono text-ink">
                  {resumeChars.toLocaleString()}
                </span>{" "}
                characters from{" "}
                <span className="font-mono">
                  {interview.resume_parsed?.source?.toUpperCase() ?? "file"}
                </span>
                .
              </p>
            ) : (
              <p className="text-[13px] italic text-ink-muted">
                No resume uploaded.
              </p>
            )}
          </div>
        </div>
      </section>

      <hr className="rule" />

      <QuestionsPanel interviewId={id} questions={questions} />
    </div>
  );
}
