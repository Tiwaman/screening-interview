import type { SupabaseClient } from "@supabase/supabase-js";
import { parseResume } from "@/lib/parse/resume";
import { SENIORITY_VALUES, type Seniority } from "@/lib/types";

export type CreateInterviewInput = {
  roleTitle: string;
  seniority: string;
  jdText: string | null;
  resumeFile: File | null;
};

export type CreateInterviewSuccess = { ok: true; id: string };
export type CreateInterviewFailure = { ok: false; error: string };
export type CreateInterviewResult =
  | CreateInterviewSuccess
  | CreateInterviewFailure;

/**
 * Shared interview-creation logic used by the dashboard server action and the
 * extension API. Caller passes a Supabase client already authorized for `userId`
 * (either an RLS-bound user client or a service-role client).
 */
export async function createInterviewForUser(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, "public", "public", any, any>,
  userId: string,
  input: CreateInterviewInput,
): Promise<CreateInterviewResult> {
  const roleTitle = input.roleTitle.trim();
  if (!roleTitle) return { ok: false, error: "Role title is required." };

  if (!SENIORITY_VALUES.includes(input.seniority as Seniority)) {
    return { ok: false, error: "Pick a seniority level." };
  }

  let resumeParsed = null;
  if (input.resumeFile && input.resumeFile.size > 0) {
    try {
      resumeParsed = await parseResume(input.resumeFile);
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error ? err.message : "Failed to parse resume file.",
      };
    }
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("interviews")
    .insert({
      user_id: userId,
      role_title: roleTitle,
      seniority: input.seniority,
      jd_text: input.jdText?.trim() || null,
      resume_parsed: resumeParsed,
      status: "draft",
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    return { ok: false, error: insertErr?.message ?? "Insert failed." };
  }

  const interviewId = (inserted as { id: string }).id;

  if (input.resumeFile && input.resumeFile.size > 0) {
    const ext =
      input.resumeFile.name.split(".").pop()?.toLowerCase() ?? "bin";
    const path = `${userId}/${interviewId}/resume.${ext}`;
    const { error: uploadErr } = await supabase.storage
      .from("resumes")
      .upload(path, input.resumeFile, {
        contentType: input.resumeFile.type || undefined,
        upsert: true,
      });

    if (uploadErr) {
      return { ok: false, error: `Resume upload failed: ${uploadErr.message}` };
    }

    const { error: pathErr } = await supabase
      .from("interviews")
      .update({ resume_storage_path: path })
      .eq("id", interviewId);

    if (pathErr) return { ok: false, error: pathErr.message };
  }

  return { ok: true, id: interviewId };
}
