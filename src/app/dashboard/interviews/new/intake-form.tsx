"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  createInterview,
  type CreateInterviewState,
} from "./actions";
import { SENIORITY_VALUES, SENIORITY_LABELS } from "@/lib/types";

const initialState: CreateInterviewState = {};

export function IntakeForm() {
  const [state, formAction, pending] = useActionState(
    createInterview,
    initialState,
  );

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <label
          htmlFor="role_title"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Role title <span className="text-red-500">*</span>
        </label>
        <input
          id="role_title"
          name="role_title"
          type="text"
          required
          placeholder="e.g. Senior Backend Engineer"
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-zinc-900 focus:ring-2 dark:border-zinc-800 dark:bg-zinc-950"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="seniority"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Seniority <span className="text-red-500">*</span>
        </label>
        <select
          id="seniority"
          name="seniority"
          required
          defaultValue=""
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-zinc-900 focus:ring-2 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <option value="" disabled>
            Select level…
          </option>
          {SENIORITY_VALUES.map((value) => (
            <option key={value} value={value}>
              {SENIORITY_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="jd_text"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Job description{" "}
          <span className="text-xs font-normal text-zinc-500">(optional)</span>
        </label>
        <textarea
          id="jd_text"
          name="jd_text"
          rows={8}
          placeholder="Paste the JD here. Improves question quality but not required."
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-zinc-900 focus:ring-2 dark:border-zinc-800 dark:bg-zinc-950"
        />
      </div>

      <div className="space-y-2">
        <label
          htmlFor="resume"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Candidate resume{" "}
          <span className="text-xs font-normal text-zinc-500">
            (optional, PDF / DOCX / TXT, max 8MB)
          </span>
        </label>
        <input
          id="resume"
          name="resume"
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="block w-full text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-zinc-900 hover:file:bg-zinc-200 dark:text-zinc-300 dark:file:bg-zinc-800 dark:file:text-zinc-100 dark:hover:file:bg-zinc-700"
        />
      </div>

      {state.error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {state.error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Creating…" : "Create interview"}
        </button>
        <Link
          href="/dashboard"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
