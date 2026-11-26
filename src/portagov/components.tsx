// Small components that used to come from the space SDK. The hero
// videos are real video files now, served from public/hero/.

"use client";

import { useEffect, useState } from "react";

/** Safe-area scrim at the top of the phone screen. */
export function SafeAreaTopScrim({
  backgroundColor,
}: {
  backgroundColor?: string;
}) {
  return (
    <div
      aria-hidden
      style={{
        height: "env(safe-area-inset-top, 0px)",
        backgroundColor: backgroundColor ?? "var(--surface)",
      }}
    />
  );
}

/** Inline preview for a PDF document in the wallet. */
export function PdfViewer({
  src,
  ariaLabel,
}: {
  src: string;
  ariaLabel?: string;
}) {
  return (
    <div>
      <iframe
        src={src}
        title={ariaLabel ?? "Document preview"}
        className="h-96 w-full rounded-lg border border-[var(--border)]"
      />
      <a
        href={src}
        target="_blank"
        rel="noreferrer"
        className="mt-2 inline-block text-sm font-semibold underline"
      >
        Open the document in a new tab
      </a>
    </div>
  );
}

/** Read a help step out loud with the device's own voice. The
    recorded voice notes are not portable as text files, so the same
    words are spoken by the browser instead. */
export function ListenButton({
  text,
  label,
}: {
  text: string;
  label: string;
}) {
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    setSupported(
      typeof window !== "undefined" && "speechSynthesis" in window,
    );
    return () => {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // No voice running.
      }
    };
  }, []);
  if (!supported) return null;
  return (
    <button
      type="button"
      className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-4 py-2 text-sm font-semibold text-[var(--text)]"
      aria-label={label}
      onClick={() => {
        if (speaking) {
          window.speechSynthesis.cancel();
          setSpeaking(false);
          return;
        }
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-LR";
        utterance.onend = () => setSpeaking(false);
        utterance.onerror = () => setSpeaking(false);
        setSpeaking(true);
        window.speechSynthesis.speak(utterance);
      }}
    >
      {speaking ? "Stop" : "Listen"}
    </button>
  );
}
