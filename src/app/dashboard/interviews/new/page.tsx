import Link from "next/link";
import { IntakeForm } from "./intake-form";

export default function NewInterviewPage() {
  return (
    <div className="grid grid-cols-12 gap-10">
      <aside className="col-span-12 lg:col-span-4">
        <Link
          href="/dashboard"
          className="text-[12px] text-ink-muted ink-link"
        >
          ← Back to interviews
        </Link>
        <p className="chapter-mark mt-6 text-[36px]">§</p>
        <h1 className="mt-2 font-display text-[44px] leading-[1.02] tracking-tight">
          New
          <br />
          <span className="font-display-italic text-accent">interview.</span>
        </h1>
        <p className="mt-5 max-w-[36ch] text-[15px] leading-relaxed text-ink-soft">
          Role title and seniority are required. Drop in a JD or resume if you
          have them — the questions get sharper with each.
        </p>

        <div className="mt-10 space-y-4 border-t border-rule pt-6">
          <p className="eyebrow">What happens next</p>
          <ol className="space-y-2 text-[13px] leading-relaxed text-ink-soft">
            <li>
              <span className="numeral mr-2 text-accent">01</span>
              We parse the resume, if attached.
            </li>
            <li>
              <span className="numeral mr-2 text-accent">02</span>
              You land on the interview page.
            </li>
            <li>
              <span className="numeral mr-2 text-accent">03</span>
              Click <em>Generate</em> to draft a question set.
            </li>
          </ol>
        </div>
      </aside>

      <section className="col-span-12 lg:col-span-8">
        <IntakeForm />
      </section>
    </div>
  );
}
