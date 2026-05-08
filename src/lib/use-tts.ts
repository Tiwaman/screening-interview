"use client";

import { useEffect, useRef, useState } from "react";

export type TtsState = "idle" | "speaking";

const STORAGE_KEY = "tts.voiceURI";

export function useTts() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURIState] = useState<string | null>(null);
  const [state, setState] = useState<TtsState>("idle");
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;

    function loadVoices() {
      const v = synth.getVoices();
      setVoices(v);
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored && v.some((vc) => vc.voiceURI === stored)) {
        setVoiceURIState(stored);
      } else {
        // Prefer en-US neural voices when available.
        const preferred =
          v.find((vc) => /en[-_]US/i.test(vc.lang) && /natural|neural|google/i.test(vc.name)) ||
          v.find((vc) => vc.lang.toLowerCase().startsWith("en")) ||
          v[0];
        setVoiceURIState(preferred?.voiceURI ?? null);
      }
    }

    loadVoices();
    synth.addEventListener("voiceschanged", loadVoices);
    return () => synth.removeEventListener("voiceschanged", loadVoices);
  }, []);

  function setVoiceURI(uri: string) {
    setVoiceURIState(uri);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, uri);
    }
  }

  function speak(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (!text.trim()) return;
    const synth = window.speechSynthesis;
    synth.cancel();

    const utter = new SpeechSynthesisUtterance(text);
    const voice = voices.find((v) => v.voiceURI === voiceURI);
    if (voice) utter.voice = voice;
    utter.rate = 1;
    utter.pitch = 1;
    utter.onstart = () => setState("speaking");
    utter.onend = () => setState("idle");
    utter.onerror = () => setState("idle");
    utterRef.current = utter;
    synth.speak(utter);
  }

  function stop() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setState("idle");
  }

  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  return { supported, voices, voiceURI, setVoiceURI, state, speak, stop };
}
