import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-black dark:text-zinc-100">
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-black/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-sm font-semibold tracking-tight">
            Screening Interview
          </span>
          <Link
            href="/login"
            className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Sign in
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-5xl px-6 py-20 sm:py-28">
          <div className="space-y-6">
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              Live screening agent · runs in any web meeting
            </span>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              An AI screening interviewer that&nbsp;
              <span className="text-emerald-700 dark:text-emerald-400">
                listens, probes, and scores
              </span>
              .
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-zinc-600 dark:text-zinc-300">
              Upload a resume and JD, get a role-tailored question set, run the
              interview in Meet / Zoom / Teams — live transcription,
              real-time follow-ups, and a structured candidate report when
              you&apos;re done.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/login"
                className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Start screening — free
              </Link>
              <a
                href="#how"
                className="rounded-lg border border-zinc-200 bg-white px-5 py-2.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                How it works
              </a>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-y border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mx-auto grid max-w-5xl gap-6 px-6 py-16 sm:grid-cols-2 lg:grid-cols-3">
            <Feature
              title="Role-aware questions"
              body="Gemini drafts 8–12 questions weighted by the JD's must-haves and probes specific resume claims."
            />
            <Feature
              title="Live transcription"
              body="Tab audio is captured locally and transcribed by Whisper on Groq — sub-second, accurate, no upload of raw recordings."
            />
            <Feature
              title="Real-time follow-ups"
              body="After each answer the agent decides whether to probe deeper, surfacing a contextual follow-up you can ask with one click."
            />
            <Feature
              title="Structured scoring"
              body="Six-dimension rubric with verbatim transcript quotes as evidence. Hire / no-hire signal with confidence."
            />
            <Feature
              title="No installs to start"
              body="Runs entirely in the browser. Share the meeting tab, recording stays local, transcripts auto-save."
            />
            <Feature
              title="Your data, your account"
              body="Magic-link sign-in. Resumes encrypted at rest. RLS scopes every row to the recruiter who created it."
            />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-2xl font-semibold tracking-tight">
            How it works
          </h2>
          <ol className="mt-8 space-y-6">
            <Step
              n="1"
              title="Set up the interview"
              body="Drop in the role title and seniority. Optionally add the JD and the candidate's resume — the more context, the sharper the questions."
            />
            <Step
              n="2"
              title="Generate questions"
              body="Click Generate. You get a curated mix — warm-up, technical depth, resume probes, role-specific. Edit, reorder, or delete anything you don't like."
            />
            <Step
              n="3"
              title="Run it in your meeting"
              body="Start the live interview, share the meeting tab. Audio is transcribed live and the agent watches for moments worth probing."
            />
            <Step
              n="4"
              title="End with a report"
              body="One click produces a scored report with quoted evidence per dimension. Export as PDF for your hiring team."
            />
          </ol>
        </section>

        {/* CTA */}
        <section className="border-t border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
          <div className="mx-auto flex max-w-5xl flex-col items-start gap-4 px-6 py-16 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Ready to run a better screen?
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Free to use. No credit card. Sign in with your email.
              </p>
            </div>
            <Link
              href="/login"
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Sign in →
            </Link>
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-6 py-8 text-xs text-zinc-500 dark:text-zinc-400">
        <p>
          Screening Interview · Built by{" "}
          <a
            href="https://github.com/Tiwaman/screening-interview"
            className="underline hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            Tiwaman
          </a>
        </p>
      </footer>
    </div>
  );
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
        {body}
      </p>
    </div>
  );
}

function Step({
  n,
  title,
  body,
}: {
  n: string;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-4">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white">
        {n}
      </span>
      <div>
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {body}
        </p>
      </div>
    </li>
  );
}
