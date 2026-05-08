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
  technical:
    "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  behavioral:
    "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
  resume_probe:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  role_specific:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  followup:
    "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
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
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No questions generated yet.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() => generateQuestionsAction(interviewId))
          }
          className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          {pending ? "Generating…" : "Generate questions with AI"}
        </button>
        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">
          Questions ({questions.length})
        </h2>
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
          className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {pending ? "Working…" : "Regenerate"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </div>
      )}

      <ul className="space-y-3">
        {questions.map((q, idx) => (
          <QuestionItem
            key={q.id}
            question={q}
            isFirst={idx === 0}
            isLast={idx === questions.length - 1}
            disabled={pending}
            onSave={(prompt) =>
              run(() => updateQuestionAction(q.id, prompt))
            }
            onDelete={() => {
              if (
                !window.confirm("Delete this question?")
              )
                return;
              run(() => deleteQuestionAction(q.id));
            }}
            onMove={(dir) => run(() => moveQuestionAction(q.id, dir))}
          />
        ))}
      </ul>
    </div>
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
    <li className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-zinc-400">
            Q{question.position}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${
              CATEGORY_TONE[question.category] ?? CATEGORY_TONE.followup
            }`}
          >
            {CATEGORY_LABEL[question.category] ?? question.category}
          </span>
          {question.difficulty && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium capitalize text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {question.difficulty}
            </span>
          )}
          {question.edited && (
            <span className="text-xs italic text-zinc-400">edited</span>
          )}
        </div>

        <div className="flex items-center gap-1">
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
          <IconBtn
            label="Delete"
            disabled={disabled}
            onClick={onDelete}
          >
            ×
          </IconBtn>
        </div>
      </div>

      <div className="mt-3">
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-zinc-900 focus:ring-2 dark:border-zinc-800 dark:bg-zinc-950"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onSave(draft);
                  setEditing(false);
                }}
                className="rounded-md bg-zinc-900 px-3 py-1 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(question.prompt);
                  setEditing(false);
                }}
                className="rounded-md border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="block w-full text-left text-sm leading-relaxed text-zinc-800 hover:text-zinc-950 dark:text-zinc-200 dark:hover:text-white"
          >
            {question.prompt}
          </button>
        )}
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
      className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-30 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
    >
      {children}
    </button>
  );
}
