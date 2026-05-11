import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const response = NextResponse.redirect(new URL("/login", request.url), {
    status: 303,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          toSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // ignore — request cookies are read-only after response starts
            }
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  await supabase.auth.signOut();
  return response;
}
