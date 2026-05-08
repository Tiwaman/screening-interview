"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ReportActions({
  interviewId,
  hasReport,
}: {
  interviewId: string;
  hasReport: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleGenerate() {
    if (
      hasReport &&
      !window.confirm(
        "Regenerate replaces the existing report. Continue?",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/reports/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ interviewId }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          setError(`${res.status}: ${body || "Generation failed"}`);
          return;
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Generation failed");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={handleGenerate}
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending
          ? "Generating…"
          : hasReport
            ? "Regenerate"
            : "Generate report"}
      </button>
      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
