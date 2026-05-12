import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="border-b border-rule bg-canvas/80 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-8 py-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="font-display text-[18px] leading-none">
              Screening
              <span className="font-display-italic text-accent">
                {" "}
                Interview
              </span>
            </span>
            <span className="hidden h-3 w-px bg-rule sm:block" />
            <span className="eyebrow hidden sm:inline">Studio</span>
          </Link>
          <div className="flex items-center gap-5">
            <Link
              href="/dashboard/extension"
              className="text-[13px] ink-link"
            >
              Extension
            </Link>
            <span className="hidden text-[12px] text-ink-muted sm:inline">
              {user.email}
            </span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="border border-ink/20 bg-transparent px-3 py-1.5 text-[12px] font-medium text-ink-soft transition-colors hover:border-ink hover:text-ink"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1280px] px-8 py-12">{children}</main>
    </div>
  );
}
