import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SENIORITY_LABELS, type Seniority } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: interviews } = await supabase
    .from("interviews")
    .select("id, role_title, seniority, status, created_at")
    .order("created_at", { ascending: false });

  const list = interviews ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Interviews</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Set up a new screening interview or resume an existing one.
          </p>
        </div>
        <Link
          href="/dashboard/interviews/new"
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          + New interview
        </Link>
      </div>

      {list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-950">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No interviews yet. Click <span className="font-medium">New interview</span>{" "}
            to set one up.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {list.map((row) => (
            <li key={row.id}>
              <Link
                href={`/dashboard/interviews/${row.id}`}
                className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {row.role_title}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {SENIORITY_LABELS[row.seniority as Seniority]} ·{" "}
                    {new Date(row.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium capitalize text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  {row.status}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
