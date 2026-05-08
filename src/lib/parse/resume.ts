import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";
import type { ResumeParsed } from "@/lib/types";

const MAX_BYTES = 8 * 1024 * 1024; // 8MB

export async function parseResume(file: File): Promise<ResumeParsed> {
  if (file.size > MAX_BYTES) {
    throw new Error("Resume exceeds 8MB limit");
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    const pdf = await getDocumentProxy(buffer);
    const { text } = await extractText(pdf, { mergePages: true });
    const merged = Array.isArray(text) ? text.join("\n") : text;
    return { text: merged, charCount: merged.length, source: "pdf" };
  }

  if (
    name.endsWith(".docx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    return { text: value, charCount: value.length, source: "docx" };
  }

  if (name.endsWith(".txt") || file.type === "text/plain") {
    const text = new TextDecoder().decode(buffer);
    return { text, charCount: text.length, source: "txt" };
  }

  throw new Error("Unsupported resume format. Use PDF, DOCX, or TXT.");
}
