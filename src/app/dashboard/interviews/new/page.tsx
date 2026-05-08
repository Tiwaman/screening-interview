import Link from "next/link";
import { IntakeForm } from "./intake-form";

export default function NewInterviewPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-1">
        <Link
          href="/dashboard"
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← Back to interviews
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          New interview
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Only role title and seniority are required. Adding a JD or candidate
          resume sharpens question generation.
        </p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <IntakeForm />
      </div>
    </div>
  );
}
