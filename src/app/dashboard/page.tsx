export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Interviews</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Set up a new screening interview or resume an existing one.
        </p>
      </div>

      <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-950">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No interviews yet. The intake wizard ships in milestone&nbsp;2.
        </p>
      </div>
    </div>
  );
}
