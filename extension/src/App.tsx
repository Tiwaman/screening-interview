import { useEffect, useState } from "react";
import {
  getToken,
  setToken,
  clearToken,
  getApiBase,
  setApiBase,
} from "./lib/storage";
import {
  listInterviews,
  getInterview,
  type InterviewSummary,
  type InterviewDetail,
} from "./lib/api";

type View =
  | { kind: "loading" }
  | { kind: "needs-token" }
  | { kind: "list"; interviews: InterviewSummary[] }
  | { kind: "detail"; data: InterviewDetail };

export function App() {
  const [view, setView] = useState<View>({ kind: "loading" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    setError(null);
    const token = await getToken();
    if (!token) {
      setView({ kind: "needs-token" });
      return;
    }
    try {
      const { interviews } = await listInterviews();
      setView({ kind: "list", interviews });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load interviews");
      setView({ kind: "needs-token" });
    }
  }

  async function openInterview(id: string) {
    setError(null);
    setView({ kind: "loading" });
    try {
      const detail = await getInterview(id);
      setView({ kind: "detail", data: detail });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load interview");
      setView({ kind: "list", interviews: [] });
      void bootstrap();
    }
  }

  async function handleSignOut() {
    await clearToken();
    setView({ kind: "needs-token" });
  }

  return (
    <div className="flex h-full flex-col">
      <Header
        canSignOut={view.kind === "list" || view.kind === "detail"}
        onSignOut={handleSignOut}
        onBack={
          view.kind === "detail" ? () => void bootstrap() : undefined
        }
      />
      <main className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-3 rounded-lg bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}
        {view.kind === "loading" && <Loading />}
        {view.kind === "needs-token" && (
          <TokenSetup onSaved={() => void bootstrap()} />
        )}
        {view.kind === "list" && (
          <InterviewList
            interviews={view.interviews}
            onOpen={openInterview}
            onRefresh={() => void bootstrap()}
          />
        )}
        {view.kind === "detail" && <InterviewView data={view.data} />}
      </main>
    </div>
  );
}

function Header({
  canSignOut,
  onSignOut,
  onBack,
}: {
  canSignOut: boolean;
  onSignOut: () => void;
  onBack?: () => void;
}) {
  return (
    <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="rounded-md text-xs text-zinc-500 hover:text-zinc-900"
          >
            ← Back
          </button>
        )}
        <span className="text-sm font-semibold tracking-tight">
          Screening Interview
        </span>
      </div>
      {canSignOut && (
        <button
          type="button"
          onClick={onSignOut}
          className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Disconnect
        </button>
      )}
    </header>
  );
}

function Loading() {
  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-xs text-zinc-500">Loading…</p>
    </div>
  );
}

function TokenSetup({ onSaved }: { onSaved: () => void }) {
  const [token, setTokenInput] = useState("");
  const [apiBase, setApiBaseInput] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void getApiBase().then(setApiBaseInput);
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!token.trim()) return;
    setSaving(true);
    if (apiBase.trim()) await setApiBase(apiBase.trim());
    await setToken(token.trim());
    setSaving(false);
    onSaved();
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">Connect to your account</h2>
        <p className="text-xs text-zinc-500">
          Generate a personal token at{" "}
          <a
            className="underline"
            href="https://screening-interview.vercel.app/dashboard/extension"
            target="_blank"
            rel="noreferrer"
          >
            /dashboard/extension
          </a>{" "}
          and paste it below.
        </p>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-700">
          Access token
        </label>
        <input
          type="password"
          value={token}
          onChange={(e) => setTokenInput(e.target.value)}
          placeholder="sit_…"
          className="w-full rounded-md border border-zinc-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-700">API URL</label>
        <input
          type="url"
          value={apiBase}
          onChange={(e) => setApiBaseInput(e.target.value)}
          className="w-full rounded-md border border-zinc-200 px-2 py-1.5 text-xs font-mono outline-none focus:ring-2 focus:ring-zinc-900"
        />
        <p className="text-[10px] text-zinc-400">
          Override only if running locally (e.g. http://localhost:3000).
        </p>
      </div>

      <button
        type="submit"
        disabled={saving || !token.trim()}
        className="w-full rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Connect"}
      </button>
    </form>
  );
}

function InterviewList({
  interviews,
  onOpen,
  onRefresh,
}: {
  interviews: InterviewSummary[];
  onOpen: (id: string) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Interviews</h2>
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-md text-xs text-zinc-500 hover:text-zinc-900"
        >
          ↻ Refresh
        </button>
      </div>

      {interviews.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-xs text-zinc-500">
          No interviews yet. Create one in the web app.
        </p>
      ) : (
        <ul className="space-y-2">
          {interviews.map((iv) => (
            <li key={iv.id}>
              <button
                type="button"
                onClick={() => onOpen(iv.id)}
                className="block w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left transition-colors hover:bg-zinc-50"
              >
                <p className="text-sm font-medium">{iv.role_title}</p>
                <p className="mt-0.5 flex items-center gap-2 text-[11px] text-zinc-500">
                  <span className="capitalize">{iv.seniority}</span>
                  <span>·</span>
                  <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 capitalize">
                    {iv.status}
                  </span>
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InterviewView({ data }: { data: InterviewDetail }) {
  const { interview, questions } = data;
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold tracking-tight">
          {interview.role_title}
        </h2>
        <p className="mt-0.5 text-[11px] capitalize text-zinc-500">
          {interview.seniority} · {interview.status}
        </p>
      </div>

      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Questions ({questions.length})
        </h3>
        {questions.length === 0 ? (
          <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500">
            No questions yet — generate them in the web app.
          </p>
        ) : (
          <ol className="space-y-2">
            {questions.map((q) => (
              <li
                key={q.id}
                className="rounded-lg border border-zinc-200 bg-white p-3"
              >
                <div className="flex items-center gap-1.5 text-[10px] font-medium">
                  <span className="font-mono text-zinc-400">Q{q.position}</span>
                  <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 capitalize text-zinc-700">
                    {q.category.replace("_", " ")}
                  </span>
                  {q.difficulty && (
                    <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 capitalize text-zinc-700">
                      {q.difficulty}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-zinc-800">
                  {q.prompt}
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="rounded-lg border border-dashed border-zinc-300 p-4 text-center">
        <p className="text-xs text-zinc-500">
          Live audio + transcription lands in milestone 5.
        </p>
      </div>
    </div>
  );
}
