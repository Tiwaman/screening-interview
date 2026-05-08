// Open the side panel when the toolbar icon is clicked.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error("Failed to set panel behavior", err));

const OFFSCREEN_URL = "offscreen.html";

async function hasOffscreenDocument(): Promise<boolean> {
  // chrome.runtime.getContexts is the modern API (Chrome 116+).
  type Ctx = { contextType: string; documentUrl?: string };
  const contexts = (await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"] as chrome.runtime.ContextType[],
  })) as Ctx[];
  return contexts.length > 0;
}

async function ensureOffscreen() {
  if (await hasOffscreenDocument()) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ["USER_MEDIA"] as chrome.offscreen.Reason[],
    justification:
      "Capture tab audio and run MediaRecorder for live interview transcription.",
  });
}

async function closeOffscreen() {
  if (await hasOffscreenDocument()) {
    await chrome.offscreen.closeDocument();
  }
}

export {}; // ensure this file is treated as a module

type BgStartLive = {
  type: "START_LIVE";
  interviewId: string;
  questionId: string | null;
  apiBase: string;
  token: string;
  tabId: number;
  chunkMs?: number;
};

type BgStopLive = { type: "STOP_LIVE" };
type BgSetQuestion = {
  type: "SET_QUESTION";
  questionId: string | null;
};

type BgIncoming = BgStartLive | BgStopLive | BgSetQuestion;

chrome.runtime.onMessage.addListener((message: BgIncoming, _sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === "START_LIVE") {
        const streamId = await new Promise<string>((resolve, reject) => {
          chrome.tabCapture.getMediaStreamId(
            { targetTabId: message.tabId },
            (id) => {
              if (chrome.runtime.lastError || !id) {
                reject(
                  new Error(
                    chrome.runtime.lastError?.message ??
                      "tabCapture.getMediaStreamId returned no id",
                  ),
                );
              } else {
                resolve(id);
              }
            },
          );
        });

        await ensureOffscreen();
        await chrome.runtime.sendMessage({
          type: "OFFSCREEN_START",
          streamId,
          interviewId: message.interviewId,
          questionId: message.questionId,
          apiBase: message.apiBase,
          token: message.token,
          chunkMs: message.chunkMs ?? 3000,
        });
        sendResponse({ ok: true });
      } else if (message.type === "STOP_LIVE") {
        await chrome.runtime.sendMessage({ type: "OFFSCREEN_STOP" });
        await closeOffscreen();
        sendResponse({ ok: true });
      } else if (message.type === "SET_QUESTION") {
        await chrome.runtime.sendMessage({
          type: "OFFSCREEN_SET_QUESTION",
          questionId: message.questionId,
        });
        sendResponse({ ok: true });
      }
    } catch (err) {
      sendResponse({
        ok: false,
        error: err instanceof Error ? err.message : "Background failure",
      });
    }
  })();
  return true; // keep the message channel open for async sendResponse
});
