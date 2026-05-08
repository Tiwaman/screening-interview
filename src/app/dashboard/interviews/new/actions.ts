"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { parseResume } from "@/lib/parse/resume";
import { SENIORITY_VALUES, type Seniority } from "@/lib/types";

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
  if (!user) {
    return { error: "Not signed in." };
  }

  const roleTitle = (formData.get("role_title") as string | null)?.trim();
  const seniority = formData.get("seniority") as string | null;
  const jdText = (formData.get("jd_text") as string | null)?.trim() || null;
  const resumeFile = formData.get("resume") as File | null;

  if (!roleTitle) {
    return { error: "Role title is required." };
  }
  if (!seniority || !SENIORITY_VALUES.includes(seniority as Seniority)) {
    return { error: "Pick a seniority level." };
  }

  let resumeParsed = null;
  if (resumeFile && resumeFile.size > 0) {
    try {
      resumeParsed = await parseResume(resumeFile);
    } catch (err) {
      return {
        error:
          err instanceof Error ? err.message : "Failed to parse resume file.",
      };
    }
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("interviews")
    .insert({
      user_id: user.id,
      role_title: roleTitle,
      seniority,
      jd_text: jdText,
      resume_parsed: resumeParsed,
      status: "draft",
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    return { error: insertErr?.message ?? "Failed to create interview." };
  }

  const interviewId = inserted.id as string;

  if (resumeFile && resumeFile.size > 0) {
    const ext = resumeFile.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${user.id}/${interviewId}/resume.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("resumes")
      .upload(path, resumeFile, {
        contentType: resumeFile.type || undefined,
        upsert: true,
      });

    if (uploadErr) {
      return { error: `Resume upload failed: ${uploadErr.message}` };
    }

    const { error: pathErr } = await supabase
      .from("interviews")
      .update({ resume_storage_path: path })
      .eq("id", interviewId);

    if (pathErr) {
      return { error: pathErr.message };
    }
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/interviews/${interviewId}`);
}
