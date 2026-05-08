"use client";

import { useState, useTransition } from "react";
import {
  generateExtensionToken,
  revokeExtensionToken,
} from "./actions";

type TokenRow = {
  id: string;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
};

export function TokenManager({ tokens }: { tokens: TokenRow[] }) {
  const [pending, startTransition] = useTransition();
  const [label, setLabel] = useState("");
  const [revealed, setRevealed] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function handleGenerate() {
    setError(null);
    setRevealed(null);
    startTransition(async () => {
      const res = await generateExtensionToken(label || null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.token) {
        setRevealed(res.token);
        setLabel("");
      }
    });
  }

  function handleCopy() {
    if (!revealed) return;
    navigator.clipboard.writeText(revealed);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleRevoke(id: string) {
    if (!window.confirm("Revoke this token? Any extension using it will stop working."))
      return;
    setError(null);
    startTransition(async () => {
      const res = await revokeExtensionToken(id);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
        <div>
          <h2 className="text-sm font-semibold">Generate a new token</h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            The token will be shown <span className="font-medium">once</span>.
            Copy it immediately and paste into the extension.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (e.g. work laptop)"
            className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none ring-zinc-900 focus:ring-2 dark:border-zinc-800 dark:bg-zinc-950"
          />
          <button
            type="button"
            disabled={pending}
            onClick={handleGenerate}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            {pending ? "Working…" : "Generate"}
          </button>
        </div>

        {revealed && (
          <div className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950">
            <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
              Copy this now — you won&apos;t see it again.
            </p>
            <div className="flex gap-2">
              <code className="flex-1 truncate rounded bg-white px-2 py-1 font-mono text-xs text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100">
                {revealed}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">
          Active tokens ({tokens.length})
        </h2>
        {tokens.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 bg-white p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
            No active tokens.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
            {tokens.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">
                    {t.label ?? <span className="italic text-zinc-400">unlabeled</span>}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Created {new Date(t.created_at).toLocaleDateString()}{" "}
                    {t.last_used_at
                      ? `· last used ${new Date(t.last_used_at).toLocaleDateString()}`
                      : "· never used"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleRevoke(t.id)}
                  className="rounded-md border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
