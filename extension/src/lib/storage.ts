const TOKEN_KEY = "extension_token";
const API_BASE_KEY = "api_base_url";
const DEFAULT_API_BASE = "https://screening-interview.vercel.app";

export async function getToken(): Promise<string | null> {
  const result = await chrome.storage.local.get(TOKEN_KEY);
  return (result[TOKEN_KEY] as string | undefined) ?? null;
}

export async function setToken(token: string): Promise<void> {
  await chrome.storage.local.set({ [TOKEN_KEY]: token });
}

export async function clearToken(): Promise<void> {
  await chrome.storage.local.remove(TOKEN_KEY);
}

export async function getApiBase(): Promise<string> {
  const result = await chrome.storage.local.get(API_BASE_KEY);
  return (result[API_BASE_KEY] as string | undefined) ?? DEFAULT_API_BASE;
}

export async function setApiBase(url: string): Promise<void> {
  await chrome.storage.local.set({ [API_BASE_KEY]: url });
}
