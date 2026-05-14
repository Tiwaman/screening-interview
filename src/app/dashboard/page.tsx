import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SENIORITY_LABELS, type Seniority } from "@/lib/types";

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

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: interviews } = await supabase
    .from("interviews")
    .select("id, role_title, seniority, status, created_at")
    .order("created_at", { ascending: false });

  const list = interviews ?? [];

  return (
    <div className="space-y-10">
      <header className="grid grid-cols-12 gap-8 border-b border-rule pb-8">
        <div className="col-span-12 lg:col-span-8">
          <p className="eyebrow">Interviews · Issue №01</p>
          <h1 className="mt-3 font-display text-[56px] leading-[0.95] tracking-tight">
            Your <span className="font-display-italic">screens.</span>
          </h1>
          <p className="mt-4 max-w-[52ch] text-[15px] leading-relaxed text-ink-soft">
            Each row is a candidate. Pick one to resume preparation, run a live
            call, or read the report after the fact.
          </p>
        </div>
        <div className="col-span-12 flex items-end justify-end lg:col-span-4">
          <Link
            href="/dashboard/interviews/new"
            className="border border-ink bg-ink px-5 py-2.5 text-[13px] font-medium text-canvas transition-colors hover:bg-accent hover:border-accent"
          >
            New interview →
          </Link>
        </div>
      </header>

      {list.length === 0 ? (
        <div className="border border-dashed border-rule px-8 py-20 text-center">
          <p className="chapter-mark text-[28px]">§</p>
          <h2 className="mt-2 font-display text-[28px]">No interviews yet.</h2>
          <p className="mt-3 max-w-[42ch] mx-auto text-[14px] leading-relaxed text-ink-muted">
            Spin one up — role and seniority are the only required fields. JD
            and resume are optional and sharpen the question set.
          </p>
          <Link
            href="/dashboard/interviews/new"
            className="mt-6 inline-flex items-baseline gap-2 font-display text-[18px] leading-none ink-link-accent"
          >
            Begin <span aria-hidden>→</span>
          </Link>
        </div>
      ) : (
        <ul className="border-t border-rule">
          {list.map((row, idx) => (
            <li key={row.id} className="border-b border-rule">
              <Link
                href={`/dashboard/interviews/${row.id}`}
                className="group grid grid-cols-12 items-baseline gap-4 px-2 py-6 transition-colors hover:bg-canvas-deep/40"
              >
                <span className="col-span-1 numeral text-[18px] text-ink-muted">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <div className="col-span-7">
                  <p className="font-display text-[24px] leading-tight text-ink transition-colors group-hover:text-accent">
                    {row.role_title}
                  </p>
                  <p className="mt-1 text-[12px] text-ink-muted">
                    {SENIORITY_LABELS[row.seniority as Seniority]} ·{" "}
                    {new Date(row.created_at).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <span
                  className={`col-span-3 eyebrow text-right ${
                    STATUS_TONE[row.status] ?? "text-ink-muted"
                  }`}
                >
                  {STATUS_LABEL[row.status] ?? row.status}
                </span>
                <span
                  aria-hidden
                  className="col-span-1 text-right text-[18px] text-ink-muted transition-transform group-hover:translate-x-1 group-hover:text-accent"
                >
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
