import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/dashboard");

  return (
    <div className="paper-grain min-h-screen bg-canvas text-ink">
      {/* Top bar */}
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-8 py-5">
          <div className="flex items-center gap-3">
            <span className="font-display text-[20px] leading-none tracking-tight">
              Screening
              <span className="font-display-italic text-accent">
                {" "}
                Interview
              </span>
            </span>
            <span className="hidden h-3 w-px bg-rule sm:block" />
            <span className="hidden eyebrow sm:inline">
              Issue №01 · Recruiter Edition
            </span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#chapter-i" className="ink-link hidden text-sm sm:inline">
              What it does
            </a>
            <a
              href="#chapter-ii"
              className="ink-link hidden text-sm md:inline"
            >
              How it works
            </a>
            <Link
              href="/login"
              className="rounded-none border border-ink bg-ink px-5 py-2 text-[13px] font-medium text-canvas transition-colors hover:bg-accent hover:border-accent"
            >
              Sign in →
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-8">
        {/* ───── HERO ───── */}
        <section className="grid grid-cols-12 gap-x-8 pt-16 pb-24 sm:pt-24 sm:pb-32">
          {/* Left — headline */}
          <div className="col-span-12 lg:col-span-8">
            <p className="eyebrow animate-fade stagger-1">
              A recruiter&apos;s quiet companion
            </p>
            <h1 className="mt-6 font-display text-[64px] leading-[0.95] tracking-tight sm:text-[88px] lg:text-[112px]">
              <span className="block animate-lift stagger-2">Runs the</span>
              <span className="block animate-lift stagger-3">screen,</span>
              <span className="block animate-lift stagger-4">
                <span className="font-display-italic text-accent">
                  quietly,
                </span>
              </span>
              <span className="block animate-lift stagger-5">
                while you talk.
              </span>
            </h1>
            <div className="mt-10 max-w-[44ch] animate-fade stagger-6">
              <p className="text-[18px] leading-[1.55] text-ink-soft">
                Tab audio goes in. A live transcript comes out. Real-time
                follow-ups surface in the margin. When the call ends, a
                structured, quote-backed report is waiting.
              </p>
              <div className="mt-8 flex items-baseline gap-8">
                <Link
                  href="/login"
                  className="inline-flex items-baseline gap-2 font-display text-[22px] leading-none ink-link-accent"
                >
                  Begin <span aria-hidden>→</span>
                </Link>
                <a
                  href="#chapter-i"
                  className="text-[13px] text-ink-muted ink-link"
                >
                  Or read more first
                </a>
              </div>
            </div>
          </div>

          {/* Right — masthead column */}
          <aside className="col-span-12 mt-16 flex flex-col lg:col-span-4 lg:mt-0 lg:border-l lg:border-rule lg:pl-10">
            <p className="eyebrow animate-fade stagger-3">On the cover</p>
            <p className="numeral mt-2 text-[200px] leading-[0.85] text-ink animate-lift stagger-4">
              <span className="font-display-italic">01</span>
            </p>
            <p className="mt-4 pull-quote text-[22px] text-ink-soft animate-fade stagger-5">
              &ldquo;The candidate said it. The agent caught it. You asked
              the right next thing.&rdquo;
            </p>
            <div className="mt-8 border-t border-rule pt-4">
              <p className="eyebrow">In this issue</p>
              <ul className="mt-3 space-y-1.5 text-[13px] text-ink-soft">
                <li>· Live transcription</li>
                <li>· Real-time follow-ups</li>
                <li>· Six-dimension scoring</li>
                <li>· Quoted evidence</li>
                <li>· Runs in any browser meeting</li>
              </ul>
            </div>
          </aside>
        </section>

        <hr className="rule-thick animate-rule stagger-3" />

        {/* ───── CHAPTER I — FEATURES ───── */}
        <section id="chapter-i" className="py-24">
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 lg:col-span-3">
              <p className="chapter-mark text-[40px]">§ I</p>
              <h2 className="mt-2 font-display text-[36px] leading-tight">
                What it
                <br />
                <span className="font-display-italic">does</span>
              </h2>
              <p className="mt-4 text-[14px] text-ink-muted">
                Three quiet jobs that change how a screen feels.
              </p>
            </div>

            <div className="col-span-12 grid gap-x-10 gap-y-12 sm:grid-cols-3 lg:col-span-9">
              <FeatureColumn
                num="01"
                label="Listens"
                body="Captures the candidate's audio from your meeting tab and transcribes it on the fly with Whisper. Nothing leaves the call; recordings aren't kept."
              />
              <FeatureColumn
                num="02"
                label="Probes"
                body="Watches the answer take shape. When it senses a vague claim or a buzzword without substance, a follow-up appears — your call whether to ask it."
              />
              <FeatureColumn
                num="03"
                label="Scores"
                body="At the end, you get a structured report — six dimensions, verbatim transcript quotes as evidence, a candid hire recommendation."
              />
            </div>
          </div>
        </section>

        <hr className="rule" />

        {/* ───── CHAPTER II — HOW IT WORKS ───── */}
        <section id="chapter-ii" className="py-24">
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 lg:col-span-4">
              <p className="chapter-mark text-[40px]">§ II</p>
              <h2 className="mt-2 font-display text-[44px] leading-[1.05]">
                Four steps,
                <br />
                <span className="font-display-italic">in order.</span>
              </h2>
              <p className="mt-6 max-w-[34ch] text-[15px] leading-relaxed text-ink-muted">
                The whole thing slots into the screen you were going to run
                anyway. No new meeting tool, no candidate-side setup.
              </p>
            </div>

            <ol className="col-span-12 space-y-10 lg:col-span-8">
              <Step
                n="01"
                title="Set the brief"
                body="Role and seniority are the only requirements. Drop in the JD and the candidate's resume if you have them — the questions get sharper with each."
              />
              <Step
                n="02"
                title="Generate a question set"
                body="Eight to twelve curated questions — warm-up, technical depth, resume probes, role-specific. Edit, reorder, or delete anything you don't like before the call."
              />
              <Step
                n="03"
                title="Run the call as you normally would"
                body="Start the live interview, share your meeting tab. Audio is transcribed locally. Follow-ups surface in real time. You stay in charge of pacing."
              />
              <Step
                n="04"
                title="Read the report"
                body="One click produces a scored evaluation with quoted evidence per dimension. Export as PDF and pass it to your hiring panel."
              />
            </ol>
          </div>
        </section>

        <hr className="rule" />

        {/* ───── PULL QUOTE ───── */}
        <section className="py-32">
          <div className="mx-auto max-w-[60ch] text-center">
            <p className="chapter-mark text-[32px]">§ III</p>
            <blockquote className="mt-6 pull-quote text-[44px] leading-[1.05] text-ink sm:text-[56px]">
              Transcribed by <span className="text-accent">Whisper.</span>{" "}
              Probed by <span className="text-accent">Llama.</span> Scored by{" "}
              <span className="text-accent">Gemini.</span>
            </blockquote>
            <p className="mt-8 text-[13px] text-ink-muted">
              <span className="eyebrow">Three models</span>
              <span className="mx-3 inline-block h-3 w-px bg-rule align-middle" />
              <span className="eyebrow">One judgment</span>
            </p>
          </div>
        </section>

        <hr className="rule-thick" />

        {/* ───── CTA ───── */}
        <section className="grid grid-cols-12 gap-8 py-24">
          <div className="col-span-12 lg:col-span-8">
            <p className="chapter-mark text-[40px]">§ IV</p>
            <h2 className="mt-2 font-display text-[64px] leading-[0.95] tracking-tight">
              Ready to begin
              <span className="text-accent">?</span>
            </h2>
            <p className="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-ink-soft">
              It&apos;s free. Sign in with an email — a magic link arrives
              in seconds. The first interview takes about three minutes to
              set up.
            </p>
            <Link
              href="/login"
              className="mt-10 inline-flex items-baseline gap-3 border-b-2 border-accent pb-1 font-display text-[28px] leading-none text-accent transition-colors hover:text-accent-deep"
            >
              Sign in <span aria-hidden>→</span>
            </Link>
          </div>

          <aside className="col-span-12 lg:col-span-4 lg:border-l lg:border-rule lg:pl-10">
            <p className="eyebrow">A note on privacy</p>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">
              Magic-link sign in. Resumes encrypted at rest in Supabase.
              Audio is transcribed and the original chunks aren&apos;t
              stored. Row-level security scopes every interview to the
              recruiter who created it.
            </p>
          </aside>
        </section>
      </main>

      {/* ───── FOOTER ───── */}
      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-[1280px] flex-col items-start justify-between gap-4 px-8 py-10 sm:flex-row sm:items-center">
          <p className="eyebrow">
            Screening Interview · MMXXVI · A recruiter&apos;s companion
          </p>
          <p className="text-[12px] text-ink-muted">
            Built by{" "}
            <a
              href="https://github.com/Tiwaman/screening-interview"
              className="ink-link"
            >
              Tiwaman
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureColumn({
  num,
  label,
  body,
}: {
  num: string;
  label: string;
  body: string;
}) {
  return (
    <div className="border-t border-rule pt-5">
      <p className="numeral text-[13px] font-mono tracking-wider text-accent">
        № {num}
      </p>
      <h3 className="mt-3 font-display text-[26px] leading-tight">{label}</h3>
      <p className="mt-3 text-[14px] leading-relaxed text-ink-soft">{body}</p>
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
    <li className="grid grid-cols-12 gap-6 border-t border-rule pt-6">
      <p className="numeral col-span-2 text-[36px] leading-none text-accent sm:col-span-1">
        {n}
      </p>
      <div className="col-span-10 sm:col-span-11">
        <h3 className="font-display text-[24px] leading-tight">{title}</h3>
        <p className="mt-2 max-w-[60ch] text-[15px] leading-relaxed text-ink-soft">
          {body}
        </p>
      </div>
    </li>
  );
}
