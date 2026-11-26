// Small components that used to come from the space SDK, plus the
// replacements for the two hero videos, which are not portable as
// files: a waving Liberia flag drawn as SVG for the citizen hero, and
// the animated PortaGov logo for the platform hero.

"use client";

import { useEffect, useState } from "react";
import { logoMark } from "./assets";

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

/** The flag of Liberia: eleven red and white stripes, a blue canton
    with one white star. Drawn as SVG so it needs no video file, and
    it waves gently, dimmed behind the hero text exactly as before. */
export function LiberiaFlagHero() {
  const stripes = [];
  for (let i = 0; i < 11; i++) {
    stripes.push(
      <rect
        key={i}
        x="0"
        y={(i * 100) / 11}
        width="190"
        height={100 / 11 + 0.2}
        fill={i % 2 === 0 ? "#bf0a30" : "#ffffff"}
      />,
    );
  }
  const star = (() => {
    const cx = 38;
    const cy = 500 / 22;
    const outer = 17;
    const inner = 6.8;
    const points: string[] = [];
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? outer : inner;
      const angle = (Math.PI / 5) * i - Math.PI / 2;
      points.push(
        `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`,
      );
    }
    return <polygon points={points.join(" ")} fill="#ffffff" />;
  })();
  return (
    <div
      aria-hidden
      className="hero-bg-video absolute inset-0 overflow-hidden opacity-40"
    >
      <svg
        className="hero-flag-wave h-full w-full"
        viewBox="0 0 190 100"
        preserveAspectRatio="xMidYMid slice"
      >
        {stripes}
        <rect x="0" y="0" width="76" height={500 / 11} fill="#002868" />
        {star}
      </svg>
    </div>
  );
}

const WORDMARK = "portagov".split("");

/** The platform hero animation: the PortaGov mark with the wordmark
    fading in letter by letter with a gentle rise, and a thin gold
    line sweeping under the word once, the effect chosen for the brand. */
export function LogoAnimationHero() {
  return (
    <div
      aria-hidden
      className="hero-bg-video absolute inset-0 flex flex-col items-center justify-center gap-4 opacity-70"
    >
      <img
        src={logoMark}
        alt=""
        className="h-24 w-24 rounded-full bg-white object-cover"
      />
      <div className="flex flex-col items-center">
        <span className="flex font-display text-4xl font-bold lowercase tracking-tight text-white md:text-5xl">
          {WORDMARK.map((letter, i) => (
            <span
              key={i}
              className="logo-letter"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              {letter}
            </span>
          ))}
        </span>
        <span
          className="gold-sweep mt-2 block h-[3px] w-40 rounded-full"
          style={{ backgroundColor: "#d9a821" }}
        />
        <span className="mt-2 text-xs font-bold uppercase tracking-[0.3em] text-white/70">
          Citizens. Services. Connected.
        </span>
      </div>
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
