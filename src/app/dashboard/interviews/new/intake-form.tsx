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
    <form action={formAction} className="space-y-8">
      <Field
        label="Role title"
        hint="Pick the role being interviewed for."
        required
      >
        <input
          id="role_title"
          name="role_title"
          type="text"
          required
          placeholder="Senior Backend Engineer"
          className="w-full border-0 border-b-2 border-ink bg-transparent pb-2 text-[20px] font-display outline-none placeholder:text-ink-muted/50 focus:border-accent"
        />
      </Field>

      <Field
        label="Seniority"
        hint="Sets the bar for evaluation."
        required
      >
        <select
          id="seniority"
          name="seniority"
          required
          defaultValue=""
          className="w-full border-0 border-b-2 border-ink bg-transparent pb-2 text-[20px] font-display outline-none focus:border-accent"
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
      </Field>

      <Field
        label="Job description"
        hint="Paste or skip. Adding it sharpens role-specific questions."
        optional
      >
        <textarea
          id="jd_text"
          name="jd_text"
          rows={8}
          placeholder="Paste the JD…"
          className="w-full border border-rule bg-canvas-deep/30 px-3 py-3 text-[14px] leading-relaxed font-sans outline-none placeholder:text-ink-muted/50 focus:border-ink focus:bg-canvas"
        />
      </Field>

      <Field
        label="Candidate resume"
        hint="PDF, DOCX, or TXT. Max 8MB. Optional — adding it surfaces resume-probe questions."
        optional
      >
        <input
          id="resume"
          name="resume"
          type="file"
          accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
          className="block w-full text-sm text-ink file:mr-3 file:border-0 file:bg-ink file:px-4 file:py-2 file:text-[12px] file:font-medium file:text-canvas hover:file:bg-accent file:transition-colors"
        />
      </Field>

      {state.error && (
        <div className="border-l-2 border-accent bg-canvas-deep/40 p-3 text-[13px] text-accent">
          {state.error}
        </div>
      )}

      <div className="flex items-baseline gap-6 border-t border-rule pt-6">
        <button
          type="submit"
          disabled={pending}
          className="border border-ink bg-ink px-6 py-2.5 text-[13px] font-medium text-canvas transition-colors hover:bg-accent hover:border-accent disabled:opacity-50"
        >
          {pending ? "Creating…" : "Create interview →"}
        </button>
        <Link
          href="/dashboard"
          className="text-[12px] text-ink-muted ink-link"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  required,
  optional,
  children,
}: {
  label: string;
  hint: string;
  required?: boolean;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="eyebrow">
          {label}
          {required && <span className="text-accent"> *</span>}
        </p>
        {optional && (
          <span className="text-[10px] uppercase tracking-wide text-ink-muted/70">
            Optional
          </span>
        )}
      </div>
      {children}
      <p className="text-[11px] italic text-ink-muted">{hint}</p>
    </div>
  );
}
