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
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-1">
        <Link
          href="/dashboard"
          className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          ← Back to interviews
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Browser extension
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          The extension talks to your account through a personal access token.
          Generate one, paste it into the extension, and you&apos;re connected.
        </p>
      </div>

      <TokenManager tokens={data ?? []} />
    </div>
  );
}
