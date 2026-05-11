"use client";

import { useState, useTransition } from "react";
import { deleteInterviewAction } from "./delete-action";

export function DeleteInterviewButton({ interviewId }: { interviewId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    if (
      !window.confirm(
        "Delete this interview? Questions, transcripts, and the report will all be removed. This cannot be undone.",
      )
    )
      return;
    setError(null);
    startTransition(async () => {
      const result = await deleteInterviewAction(interviewId);
      if (result && !result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={handleDelete}
        className="rounded-md border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:bg-zinc-950 dark:text-red-400 dark:hover:bg-red-950"
      >
        {pending ? "Deleting…" : "Delete interview"}
      </button>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
