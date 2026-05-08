import { getApiBase, getToken } from "./storage";

export type LiveTranscriptChunk = {
  text: string;
  questionId: string | null;
  receivedAt: number;
};

export async function startLiveCapture(
  interviewId: string,
  questionId: string | null,
): Promise<{ tabId: number }> {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (!tab?.id) throw new Error("Could not find the active tab");

  const apiBase = await getApiBase();
  const token = await getToken();
  if (!token) throw new Error("Not connected. Add a token first.");

  const response = await chrome.runtime.sendMessage({
    type: "START_LIVE",
    interviewId,
    questionId,
    apiBase,
    token,
    tabId: tab.id,
  });

  if (!response?.ok) {
    throw new Error(response?.error ?? "Failed to start live capture");
  }

  return { tabId: tab.id };
}

export async function stopLiveCapture(): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: "STOP_LIVE" });
  if (!response?.ok) {
    throw new Error(response?.error ?? "Failed to stop live capture");
  }
}

export async function setLiveQuestion(
  questionId: string | null,
): Promise<void> {
  await chrome.runtime.sendMessage({
    type: "SET_QUESTION",
    questionId,
  });
}
