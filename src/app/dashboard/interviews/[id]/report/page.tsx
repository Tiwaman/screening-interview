import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SENIORITY_LABELS, type Seniority } from "@/lib/types";
import {
  REPORT_DIMENSIONS,
  DIMENSION_LABEL,
  DIMENSION_DESCRIPTION,
  HIRE_LABEL,
  HIRE_TONE,
  type DimensionScore,
  type GeneratedReport,
} from "@/lib/llm/report";
import { ReportActions } from "./report-actions";

type ReportRow = {
  scores: {
    dimensions: Record<string, DimensionScore>;
    strengths: string[];
    concerns: string[];
    red_flags: string[];
  };
  summary: string | null;
  hire_recommendation: GeneratedReport["hire_recommendation"] | null;
  confidence: number | null;
  created_at: string;
};

export default async function ReportPage({
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

  const { data: report } = await supabase
    .from("reports")
    .select(
      "scores, summary, hire_recommendation, confidence, created_at",
    )
    .eq("interview_id", id)
    .maybeSingle<ReportRow>();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
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

      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Report</h1>
          {report?.created_at && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Generated {new Date(report.created_at).toLocaleString()}
            </p>
          )}
        </div>
        <ReportActions interviewId={id} hasReport={Boolean(report)} />
      </div>

      {!report ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-950">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            No report yet. Generate one once the interview transcripts are
            captured.
          </p>
        </div>
      ) : (
        <ReportBody report={report} />
      )}
    </div>
  );
}

function ReportBody({ report }: { report: ReportRow }) {
  const hire = report.hire_recommendation ?? "lean_hire";
  const dims = report.scores.dimensions ?? ({} as Record<string, DimensionScore>);

  return (
    <div className="space-y-6">
      <div
        className={`rounded-2xl border p-5 ${HIRE_TONE[hire as keyof typeof HIRE_TONE] ?? ""}`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
            Recommendation
          </p>
          <p className="text-[11px] opacity-70">
            Confidence{" "}
            {report.confidence !== null
              ? `${Math.round(report.confidence * 100)}%`
              : "—"}
          </p>
        </div>
        <p className="mt-1 text-2xl font-semibold tracking-tight">
          {HIRE_LABEL[hire as keyof typeof HIRE_LABEL]}
        </p>
        {report.summary && (
          <p className="mt-3 text-sm leading-relaxed">{report.summary}</p>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Scores
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {REPORT_DIMENSIONS.map((dim) => (
            <DimensionCard
              key={dim}
              label={DIMENSION_LABEL[dim]}
              description={DIMENSION_DESCRIPTION[dim]}
              score={dims[dim]}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2">
        <BulletCard
          title="Strengths"
          items={report.scores.strengths ?? []}
          tone="emerald"
        />
        <BulletCard
          title="Concerns"
          items={report.scores.concerns ?? []}
          tone="amber"
        />
      </div>

      {(report.scores.red_flags ?? []).length > 0 && (
        <BulletCard
          title="Red flags"
          items={report.scores.red_flags ?? []}
          tone="red"
        />
      )}
    </div>
  );
}

function DimensionCard({
  label,
  description,
  score,
}: {
  label: string;
  description: string;
  score: DimensionScore | undefined;
}) {
  const value = score?.value ?? 3;
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">{label}</p>
        <Stars value={value} />
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        {description}
      </p>
      {score?.evidence && score.evidence.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          {score.evidence.map((q, i) => (
            <li
              key={i}
              className="text-xs italic leading-relaxed text-zinc-600 dark:text-zinc-300"
            >
              &ldquo;{q}&rdquo;
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stars({ value }: { value: number }) {
  const v = Math.max(1, Math.min(5, Math.round(value)));
  return (
    <span className="flex items-center gap-0.5 text-sm">
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          className={
            i <= v
              ? "text-amber-500"
              : "text-zinc-300 dark:text-zinc-700"
          }
          aria-hidden
        >
          ★
        </span>
      ))}
      <span className="ml-1 text-xs font-mono text-zinc-500 dark:text-zinc-400">
        {v}/5
      </span>
    </span>
  );
}

const TONES = {
  emerald:
    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  amber:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  red: "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950 dark:text-red-200",
};

function BulletCard({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: keyof typeof TONES;
}) {
  return (
    <section className={`rounded-2xl border p-4 ${TONES[tone]}`}>
      <h3 className="text-xs font-semibold uppercase tracking-wide opacity-80">
        {title}
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-xs italic opacity-70">None noted.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="text-sm leading-relaxed">
              · {it}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
