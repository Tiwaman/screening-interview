import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TokenManager } from "./token-manager";

export default async function ExtensionPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("extension_tokens")
    .select("id, label, created_at, last_used_at")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="space-y-3 border-b border-rule pb-8">
        <Link
          href="/dashboard"
          className="text-[12px] text-ink-muted ink-link"
        >
          ← Back to interviews
        </Link>
        <p className="eyebrow">Personal access</p>
        <h1 className="font-display text-[44px] leading-[1.02] tracking-tight">
          Browser{" "}
          <span className="font-display-italic text-accent">extension.</span>
        </h1>
        <p className="max-w-[60ch] text-[15px] leading-relaxed text-ink-soft">
          The extension talks to your account through a personal access token.
          Generate one, paste it into the side panel, and the two are linked.
        </p>
      </header>

      <TokenManager tokens={data ?? []} />
    </div>
  );
}
