"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type TokenActionResult =
  | { ok: true; token?: string }
  | { ok: false; error: string };

export async function generateExtensionToken(
  label: string | null,
): Promise<TokenActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const token = `sit_${randomBytes(32).toString("base64url")}`;

  const { error } = await supabase.from("extension_tokens").insert({
    user_id: user.id,
    token,
    label: label?.trim() || null,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard/extension");
  return { ok: true, token };
}

export async function revokeExtensionToken(
  tokenId: string,
): Promise<TokenActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("extension_tokens")
    .delete()
    .eq("id", tokenId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/extension");
  return { ok: true };
}
