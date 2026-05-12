"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle",
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setErrorMsg(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <div className="paper-grain min-h-screen bg-canvas text-ink">
      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-8 py-5">
          <Link href="/" className="font-display text-[20px] leading-none">
            Screening
            <span className="font-display-italic text-accent"> Interview</span>
          </Link>
          <span className="eyebrow hidden sm:inline">
            Issue №01 · Sign in
          </span>
        </div>
      </header>

      <main className="mx-auto grid min-h-[calc(100vh-72px)] max-w-[1280px] grid-cols-12 gap-x-8 px-8 py-16">
        <section className="col-span-12 flex items-center lg:col-span-7">
          <div className="max-w-[40ch]">
            <p className="eyebrow animate-fade stagger-1">
              Sign in to continue
            </p>
            <h1 className="mt-6 font-display text-[64px] leading-[0.95] tracking-tight animate-lift stagger-2">
              A magic link,{" "}
              <span className="font-display-italic text-accent">
                nothing else.
              </span>
            </h1>
            <p className="mt-6 text-[17px] leading-relaxed text-ink-soft animate-fade stagger-3">
              We don&apos;t ask for a password. Type your email — we&apos;ll
              send a one-tap sign-in link.
            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-10 animate-fade stagger-4"
            >
              {status === "sent" ? (
                <div className="border-l-2 border-accent bg-canvas-deep/40 p-5">
                  <p className="eyebrow">Check your inbox</p>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
                    A sign-in link is on its way to{" "}
                    <span className="font-medium text-ink">{email}</span>.
                  </p>
                </div>
              ) : (
                <>
                  <label
                    htmlFor="email"
                    className="eyebrow block"
                  >
                    Your email
                  </label>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      autoComplete="email"
                      className="flex-1 border-0 border-b-2 border-ink bg-transparent pb-2 text-[20px] outline-none placeholder:text-ink-muted/60 focus:border-accent"
                    />
                    <button
                      type="submit"
                      disabled={status === "sending"}
                      className="self-start border border-ink bg-ink px-6 py-2.5 text-[14px] font-medium text-canvas transition-colors hover:bg-accent hover:border-accent disabled:opacity-50"
                    >
                      {status === "sending" ? "Sending…" : "Send link →"}
                    </button>
                  </div>

                  {errorMsg && (
                    <p className="mt-4 border-l-2 border-accent pl-3 text-[13px] text-accent">
                      {errorMsg}
                    </p>
                  )}
                </>
              )}
            </form>
          </div>
        </section>

        <aside className="col-span-12 hidden lg:col-span-5 lg:flex lg:items-center lg:border-l lg:border-rule lg:pl-12">
          <div>
            <p className="chapter-mark text-[32px]">§</p>
            <blockquote className="mt-4 pull-quote text-[28px] leading-[1.1] text-ink">
              &ldquo;Runs in the margin of the call. Surfaces what you
              would&apos;ve missed.&rdquo;
            </blockquote>
            <p className="eyebrow mt-6">A note on privacy</p>
            <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
              Sign-in cookies expire after a week of inactivity. We never
              store raw audio — only the transcribed text, scoped to your
              account.
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
