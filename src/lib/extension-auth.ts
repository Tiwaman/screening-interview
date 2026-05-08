import { getAdminClient } from "@/lib/supabase/admin";

export type ExtensionAuthResult =
  | { ok: true; userId: string }
  | { ok: false; status: number; error: string };

export async function authenticateExtensionRequest(
  request: Request,
): Promise<ExtensionAuthResult> {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { ok: false, status: 401, error: "Missing Bearer token" };
  }
  const token = match[1].trim();
  if (!token) {
    return { ok: false, status: 401, error: "Empty token" };
  }

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("extension_tokens")
    .select("user_id")
    .eq("token", token)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, error: error.message };
  }
  if (!data) {
    return { ok: false, status: 401, error: "Invalid token" };
  }

  // Fire-and-forget last_used update.
  admin
    .from("extension_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("token", token)
    .then(() => {});

  return { ok: true, userId: data.user_id as string };
}

export const EXT_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};
