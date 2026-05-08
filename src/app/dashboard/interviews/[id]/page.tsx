import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SENIORITY_LABELS, type Seniority } from "@/lib/types";

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
        <h1 className="text-2xl font-semibold tracking-tight">
          {interview.role_title}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {SENIORITY_LABELS[interview.seniority as Seniority]} · status{" "}
          <span className="font-medium">{interview.status}</span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card label="Job description">
          {interview.jd_text ? (
            <pre className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
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

      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Question generation lands in milestone&nbsp;3.
        </p>
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
