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
  createInterview,
  generateQuestions,
  updateQuestion,
  deleteQuestion,
  moveQuestion,
  type InterviewSummary,
  type InterviewDetail,
} from "./lib/api";

const SENIORITY_OPTIONS = [
  { value: "intern", label: "Intern" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid-level" },
  { value: "senior", label: "Senior" },
  { value: "staff", label: "Staff" },
  { value: "principal", label: "Principal" },
];

const CATEGORY_LABEL: Record<string, string> = {
  technical: "Technical",
  behavioral: "Behavioral",
  resume_probe: "Resume probe",
  role_specific: "Role-specific",
  followup: "Follow-up",
};

type View =
  | { kind: "loading" }
  | { kind: "needs-token" }
  | { kind: "list"; interviews: InterviewSummary[] }
  | { kind: "create" }
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
    if (!token) return setView({ kind: "needs-token" });
    try {
      const { interviews } = await listInterviews();
      setView({ kind: "list", interviews });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
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
      setError(err instanceof Error ? err.message : "Failed to load");
      void bootstrap();
    }
  }

  async function refreshDetail(id: string) {
    try {
      const detail = await getInterview(id);
      setView({ kind: "detail", data: detail });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    }
  }

  async function handleSignOut() {
    await clearToken();
    setView({ kind: "needs-token" });
  }

  return (
    <div className="flex h-full flex-col">
      <Header
        canSignOut={view.kind === "list" || view.kind === "detail" || view.kind === "create"}
        onSignOut={handleSignOut}
        onBack={
          view.kind === "detail" || view.kind === "create"
            ? () => void bootstrap()
            : undefined
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
            onCreate={() => setView({ kind: "create" })}
            onRefresh={() => void bootstrap()}
          />
        )}
        {view.kind === "create" && (
          <CreateInterviewForm
            onCreated={(id) => void openInterview(id)}
            onCancel={() => void bootstrap()}
            onError={setError}
          />
        )}
        {view.kind === "detail" && (
          <InterviewView
            data={view.data}
            onChange={() => refreshDetail(view.data.interview.id)}
            onError={setError}
          />
        )}
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
        <label className="text-xs font-medium text-zinc-700">Access token</label>
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
  onCreate,
  onRefresh,
}: {
  interviews: InterviewSummary[];
  onOpen: (id: string) => void;
  onCreate: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Interviews</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-md text-xs text-zinc-500 hover:text-zinc-900"
            aria-label="Refresh"
          >
            ↻
          </button>
          <button
            type="button"
            onClick={onCreate}
            className="rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white hover:bg-zinc-700"
          >
            + New
          </button>
        </div>
      </div>

      {interviews.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-xs text-zinc-500">
          No interviews yet. Click <span className="font-medium">+ New</span> to add one.
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

function CreateInterviewForm({
  onCreated,
  onCancel,
  onError,
}: {
  onCreated: (id: string) => void;
  onCancel: () => void;
  onError: (msg: string | null) => void;
}) {
  const [roleTitle, setRoleTitle] = useState("");
  const [seniority, setSeniority] = useState("");
  const [jdText, setJdText] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onError(null);
    setSubmitting(true);
    try {
      const { id } = await createInterview({
        roleTitle,
        seniority,
        jdText,
        resume,
      });
      onCreated(id);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-sm font-semibold">New interview</h2>

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-700">
          Role title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          required
          value={roleTitle}
          onChange={(e) => setRoleTitle(e.target.value)}
          placeholder="e.g. Senior Backend Engineer"
          className="w-full rounded-md border border-zinc-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-700">
          Seniority <span className="text-red-500">*</span>
        </label>
        <select
          required
          value={seniority}
          onChange={(e) => setSeniority(e.target.value)}
          className="w-full rounded-md border border-zinc-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
        >
          <option value="" disabled>
            Select…
          </option>
          {SENIORITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-700">
          JD <span className="font-normal text-zinc-400">(optional)</span>
        </label>
        <textarea
          rows={4}
          value={jdText}
          onChange={(e) => setJdText(e.target.value)}
          placeholder="Paste the job description"
          className="w-full rounded-md border border-zinc-200 px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-zinc-900"
        />
      </div>

      <div className="space-y-1">
        <label className="text-xs font-medium text-zinc-700">
          Resume <span className="font-normal text-zinc-400">(optional, PDF/DOCX/TXT)</span>
        </label>
        <input
          type="file"
          accept=".pdf,.docx,.txt"
          onChange={(e) => setResume(e.target.files?.[0] ?? null)}
          className="block w-full text-xs file:mr-2 file:rounded file:border-0 file:bg-zinc-100 file:px-2 file:py-1 file:text-xs file:font-medium hover:file:bg-zinc-200"
        />
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex-1 rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function InterviewView({
  data,
  onChange,
  onError,
}: {
  data: InterviewDetail;
  onChange: () => void;
  onError: (msg: string | null) => void;
}) {
  const { interview, questions } = data;
  const [busy, setBusy] = useState(false);

  async function run<T>(fn: () => Promise<T>) {
    onError(null);
    setBusy(true);
    try {
      await fn();
      onChange();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tight">
            {interview.role_title}
          </h2>
          <p className="mt-0.5 text-[11px] capitalize text-zinc-500">
            {interview.seniority} · {interview.status}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
          Questions ({questions.length})
        </h3>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            if (
              questions.length > 0 &&
              !window.confirm("Regenerate replaces the current set. Continue?")
            )
              return;
            void run(() => generateQuestions(interview.id));
          }}
          className="rounded-md border border-zinc-200 px-2 py-1 text-[11px] font-medium hover:bg-zinc-50 disabled:opacity-50"
        >
          {questions.length === 0 ? "Generate" : "Regenerate"}
        </button>
      </div>

      {questions.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-xs text-zinc-500">
          No questions yet — click Generate.
        </p>
      ) : (
        <ol className="space-y-2">
          {questions.map((q, idx) => (
            <QuestionCard
              key={q.id}
              question={q}
              isFirst={idx === 0}
              isLast={idx === questions.length - 1}
              busy={busy}
              onSave={(prompt) => void run(() => updateQuestion(q.id, prompt))}
              onDelete={() => {
                if (!window.confirm("Delete this question?")) return;
                void run(() => deleteQuestion(q.id));
              }}
              onMove={(dir) => void run(() => moveQuestion(q.id, dir))}
            />
          ))}
        </ol>
      )}

      <div className="rounded-lg border border-dashed border-zinc-300 p-4 text-center">
        <p className="text-xs text-zinc-500">
          Live audio + transcription lands in milestone 5.
        </p>
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  isFirst,
  isLast,
  busy,
  onSave,
  onDelete,
  onMove,
}: {
  question: import("./lib/api").Question;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  onSave: (prompt: string) => void;
  onDelete: () => void;
  onMove: (dir: "up" | "down") => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(question.prompt);

  return (
    <li className="rounded-lg border border-zinc-200 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-medium">
          <span className="font-mono text-zinc-400">Q{question.position}</span>
          <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 capitalize text-zinc-700">
            {CATEGORY_LABEL[question.category] ?? question.category.replace("_", " ")}
          </span>
          {question.difficulty && (
            <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 capitalize text-zinc-700">
              {question.difficulty}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconBtn label="Up" disabled={busy || isFirst} onClick={() => onMove("up")}>
            ↑
          </IconBtn>
          <IconBtn label="Down" disabled={busy || isLast} onClick={() => onMove("down")}>
            ↓
          </IconBtn>
          <IconBtn label="Delete" disabled={busy} onClick={onDelete}>
            ×
          </IconBtn>
        </div>
      </div>

      <div className="mt-2">
        {editing ? (
          <div className="space-y-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-zinc-200 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-zinc-900"
            />
            <div className="flex gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  onSave(draft);
                  setEditing(false);
                }}
                className="rounded-md bg-zinc-900 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraft(question.prompt);
                  setEditing(false);
                }}
                className="rounded-md border border-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="block w-full text-left text-xs leading-relaxed text-zinc-800 hover:text-zinc-900"
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
      className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}
