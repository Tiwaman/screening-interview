"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function deleteInterviewAction(interviewId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not signed in." };

  // RLS guarantees ownership; cascading deletes wipe questions/transcripts/reports.
  const { error } = await supabase
    .from("interviews")
    .delete()
    .eq("id", interviewId);

  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
