import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SENIORITY_LABELS, type Seniority } from "@/lib/types";
import { LiveInterview } from "./live-interview";

export default async function LivePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: interview, error } = await supabase
    .from("interviews")
    .select("id, role_title, seniority, status")
    .eq("id", id)
    .single<{
      id: string;
      role_title: string;
      seniority: string;
      status: string;
    }>();

  if (error || !interview) notFound();

  const { data: rawQuestions } = await supabase
    .from("questions")
    .select("id, position, category, difficulty, prompt")
    .eq("interview_id", id)
    .neq("category", "followup")
    .order("position", { ascending: true });

  const questions = (rawQuestions ?? []).map((q) => ({
    id: q.id as string,
    position: q.position as number,
    category: q.category as string,
    difficulty: (q.difficulty as string | null) ?? null,
    prompt: q.prompt as string,
  }));

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Link
          href={`/dashboard/interviews/${id}`}
          className="text-xs text-zinc-500 hover:text-zinc-700"
        >
          ← Back
        </Link>
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-950">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            No questions yet. Generate questions before starting a live
            interview.
          </p>
          <Link
            href={`/dashboard/interviews/${id}`}
            className="mt-4 inline-block rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-zinc-900"
          >
            Open interview
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/dashboard/interviews/${id}`}
          className="text-xs text-zinc-500 hover:text-zinc-700"
        >
          ← Back to interview
        </Link>
        <span className="text-[11px] uppercase tracking-wide text-zinc-500">
          {SENIORITY_LABELS[interview.seniority as Seniority]} ·{" "}
          {interview.role_title}
        </span>
      </div>

      <LiveInterview interviewId={id} questions={questions} />
    </div>
  );
}
