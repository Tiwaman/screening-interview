// Offscreen document. Runs in a hidden tab-like context so we can call
// getUserMedia + MediaRecorder for tab audio capture (not allowed in service
// workers / side panels in MV3).

type OsStart = {
  type: "OFFSCREEN_START";
  streamId: string;
  interviewId: string;
  questionId: string | null;
  apiBase: string;
  token: string;
  chunkMs: number;
};

type OsStop = { type: "OFFSCREEN_STOP" };

type OsSetQuestion = {
  type: "OFFSCREEN_SET_QUESTION";
  questionId: string | null;
};

type OsIncoming = OsStart | OsStop | OsSetQuestion;

let stream: MediaStream | null = null;
let recorder: MediaRecorder | null = null;
let audioContext: AudioContext | null = null;
let session: {
  interviewId: string;
  questionId: string | null;
  apiBase: string;
  token: string;
} | null = null;

function broadcast(message: Record<string, unknown>) {
  chrome.runtime.sendMessage({ ...message }).catch(() => {});
}

async function uploadChunk(blob: Blob) {
  if (!session) return;
  if (blob.size < 4_000) return; // skip near-silent micro-chunks

  const fd = new FormData();
  fd.set("audio", blob, "chunk.webm");
  fd.set("interview_id", session.interviewId);
  if (session.questionId) fd.set("question_id", session.questionId);

  try {
    const res = await fetch(`${session.apiBase}/api/extension/stt`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.token}` },
      body: fd,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      broadcast({
        type: "TRANSCRIPT_ERROR",
        error: `STT ${res.status}: ${text || "request failed"}`,
      });
      return;
    }
    const data = (await res.json()) as { transcript?: string };
    if (data.transcript) {
      broadcast({
        type: "TRANSCRIPT_CHUNK",
        text: data.transcript,
        questionId: session.questionId,
      });
    }
  } catch (err) {
    broadcast({
      type: "TRANSCRIPT_ERROR",
      error: err instanceof Error ? err.message : "STT request failed",
    });
  }
}

async function startCapture(msg: OsStart) {
  try {
    // Get the tab audio stream using the streamId provided by the background.
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        // @ts-expect-error — chromeMediaSource is a Chromium-only constraint
        mandatory: {
          chromeMediaSource: "tab",
          chromeMediaSourceId: msg.streamId,
        },
      },
      video: false,
    });
  } catch (err) {
    broadcast({
      type: "CAPTURE_ERROR",
      error: err instanceof Error ? err.message : "Failed to capture tab audio",
    });
    return;
  }

  // Pipe the captured audio back to speakers so the meeting still sounds
  // normal — getUserMedia({chromeMediaSource: 'tab'}) mutes playback otherwise.
  audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(audioContext.destination);

  session = {
    interviewId: msg.interviewId,
    questionId: msg.questionId,
    apiBase: msg.apiBase,
    token: msg.token,
  };

  recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      void uploadChunk(event.data);
    }
  };
  recorder.start(msg.chunkMs);

  broadcast({ type: "CAPTURE_STARTED" });
}

function stopCapture() {
  if (recorder && recorder.state !== "inactive") {
    recorder.stop();
  }
  recorder = null;

  stream?.getTracks().forEach((t) => t.stop());
  stream = null;

  audioContext?.close().catch(() => {});
  audioContext = null;
  session = null;

  broadcast({ type: "CAPTURE_STOPPED" });
}

chrome.runtime.onMessage.addListener((message: OsIncoming) => {
  if (message.type === "OFFSCREEN_START") {
    void startCapture(message);
  } else if (message.type === "OFFSCREEN_STOP") {
    stopCapture();
  } else if (message.type === "OFFSCREEN_SET_QUESTION") {
    if (session) session.questionId = message.questionId;
  }
});
