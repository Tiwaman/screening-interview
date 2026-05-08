import { GoogleGenAI } from "@google/genai";

let cached: GoogleGenAI | null = null;

export function getGemini() {
  if (cached) return cached;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  cached = new GoogleGenAI({ apiKey });
  return cached;
}

export const GEMINI_FLASH = "gemini-2.5-flash";
