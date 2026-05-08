"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createInterviewForUser } from "@/lib/interviews/create";

export type CreateInterviewState = {
  error?: string;
};

export async function createInterview(
  _prev: CreateInterviewState,
  formData: FormData,
): Promise<CreateInterviewState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const result = await createInterviewForUser(supabase, user.id, {
    roleTitle: (formData.get("role_title") as string | null) ?? "",
    seniority: (formData.get("seniority") as string | null) ?? "",
    jdText: (formData.get("jd_text") as string | null) ?? null,
    resumeFile: formData.get("resume") as File | null,
  });

  if (!result.ok) return { error: result.error };

  revalidatePath("/dashboard");
  redirect(`/dashboard/interviews/${result.id}`);
}
