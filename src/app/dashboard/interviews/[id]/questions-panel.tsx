"use client";

import { useState, useTransition } from "react";
import {
  generateQuestionsAction,
  updateQuestionAction,
  deleteQuestionAction,
  moveQuestionAction,
} from "./actions";

type Question = {
  id: string;
  position: number;
  category: string;
  difficulty: string | null;
  prompt: string;
  edited: boolean;
};

const CATEGORY_LABEL: Record<string, string> = {
  technical: "Technical",
  behavioral: "Behavioral",
  resume_probe: "Resume probe",
  role_specific: "Role-specific",
  followup: "Follow-up",
};

const CATEGORY_TONE: Record<string, string> = {
  technical: "text-emerald-grove",
  behavioral: "text-accent",
  resume_probe: "text-amber-700",
  role_specific: "text-ink-soft",
  followup: "text-ink-muted",
};

export function QuestionsPanel({
  interviewId,
  questions,
}: {
  interviewId: string;
  questions: Question[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const result = await fn();
      if (!result.ok && result.error) setError(result.error);
    });
  }

  if (questions.length === 0) {
    return (
      <div className="border border-dashed border-rule px-8 py-16 text-center">
        <p className="chapter-mark text-[28px]">§</p>
        <h2 className="mt-2 font-display text-[28px]">
          No questions yet.
        </h2>
        <p className="mt-3 max-w-[40ch] mx-auto text-[13px] leading-relaxed text-ink-muted">
          Generate eight to twelve role-aware questions. Edit, reorder, or
          delete anything that doesn&apos;t fit.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => generateQuestionsAction(interviewId))}
          className="mt-6 border border-ink bg-ink px-5 py-2.5 text-[13px] font-medium text-canvas transition-colors hover:bg-accent hover:border-accent disabled:opacity-50"
        >
          {pending ? "Generating…" : "Generate questions →"}
        </button>
        {error && (
          <p className="mt-4 text-[13px] text-accent">{error}</p>
        )}
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">§ Questions</p>
          <h2 className="mt-1 font-display text-[32px] leading-tight">
            The set ·{" "}
            <span className="font-display-italic text-accent">
              {questions.length}
            </span>
          </h2>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (
              !window.confirm(
                "Regenerate will replace the current question set. Continue?",
              )
            )
              return;
            run(() => generateQuestionsAction(interviewId));
          }}
          className="border border-rule px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink disabled:opacity-50"
        >
          {pending ? "Working…" : "Regenerate"}
        </button>
      </div>

      {error && (
        <div className="border-l-2 border-accent bg-canvas-deep/40 p-3 text-[13px] text-accent">
          {error}
        </div>
      )}

      <ol className="border-t border-rule">
        {questions.map((q, idx) => (
          <QuestionItem
            key={q.id}
            question={q}
            isFirst={idx === 0}
            isLast={idx === questions.length - 1}
            disabled={pending}
            onSave={(prompt) => run(() => updateQuestionAction(q.id, prompt))}
            onDelete={() => {
              if (!window.confirm("Delete this question?")) return;
              run(() => deleteQuestionAction(q.id));
            }}
            onMove={(dir) => run(() => moveQuestionAction(q.id, dir))}
          />
        ))}
      </ol>
    </section>
  );
}

function QuestionItem({
  question,
  isFirst,
  isLast,
  disabled,
  onSave,
  onDelete,
  onMove,
}: {
  question: Question;
  isFirst: boolean;
  isLast: boolean;
  disabled: boolean;
  onSave: (prompt: string) => void;
  onDelete: () => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(question.prompt);

  return (
    <li className="grid grid-cols-12 items-start gap-4 border-b border-rule py-5">
      <div className="col-span-1">
        <span className="numeral text-[18px] text-accent">
          {String(question.position).padStart(2, "0")}
        </span>
      </div>

      <div className="col-span-10">
        <div className="flex flex-wrap items-baseline gap-3">
          <span
            className={`eyebrow ${
              CATEGORY_TONE[question.category] ?? "text-ink-muted"
            }`}
          >
            {CATEGORY_LABEL[question.category] ?? question.category}
          </span>
          {question.difficulty && (
            <span className="text-[10px] uppercase tracking-wide text-ink-muted">
              {question.difficulty}
            </span>
          )}
          {question.edited && (
            <span className="text-[10px] italic text-ink-muted/70">
              edited
            </span>
          )}
        </div>

        <div className="mt-2">
          {editing ? (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                className="w-full border border-ink bg-canvas px-3 py-2 text-[14px] leading-relaxed font-sans outline-none"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onSave(draft);
                    setEditing(false);
                  }}
                  className="border border-ink bg-ink px-3 py-1 text-[11px] font-medium text-canvas hover:bg-accent hover:border-accent disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft(question.prompt);
                    setEditing(false);
                  }}
                  className="text-[11px] text-ink-muted ink-link"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="block w-full text-left font-sans text-[15px] leading-relaxed text-ink transition-colors hover:text-accent"
            >
              {question.prompt}
            </button>
          )}
        </div>
      </div>

      <div className="col-span-1 flex flex-col items-end gap-1 text-ink-muted">
        <IconBtn
          label="Move up"
          disabled={disabled || isFirst}
          onClick={() => onMove("up")}
        >
          ↑
        </IconBtn>
        <IconBtn
          label="Move down"
          disabled={disabled || isLast}
          onClick={() => onMove("down")}
        >
          ↓
        </IconBtn>
        <IconBtn label="Delete" disabled={disabled} onClick={onDelete}>
          ×
        </IconBtn>
      </div>
    </li>
  );
}

function IconBtn({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center text-[14px] transition-colors hover:text-accent disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}
