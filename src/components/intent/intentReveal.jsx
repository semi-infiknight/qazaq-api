import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { defaultIntentStepDelay, useIntentReveal } from "../../hooks/useIntentReveal.js";

const IntentRevealContext = createContext(null);

export function buildIntentRevealSegments(blocks) {
  const segments = ["canvas", "intro"];

  blocks.forEach((block, blockIndex) => {
    segments.push(`feature-${blockIndex}`);
    block.apis.forEach((_, apiIndex) => {
      segments.push(`api-${blockIndex}-${apiIndex}`);
    });
  });

  return segments;
}

function buildStepDelay(summary) {
  return (prevSegment, nextSegment, stepIndex) => {
    if (prevSegment === "intro" && summary) {
      return Math.min(4200, Math.max(1100, summary.length * 18 + 500));
    }
    if (prevSegment === "diagram" || prevSegment === "canvas") {
      return 680;
    }
    return defaultIntentStepDelay(prevSegment, nextSegment, stepIndex);
  };
}

export function IntentRevealProvider({ blocks, summary = "", onGeneratingChange, children }) {
  const segments = useMemo(() => buildIntentRevealSegments(blocks), [blocks]);
  const getStepDelay = useMemo(() => buildStepDelay(summary), [summary]);
  // Only re-trigger the generation animation when the blocks change (new query),
  // not when the view/tab changes.
  const generationKey = useMemo(() => blocks.map((b) => b.id).join(","), [blocks]);
  const reveal = useIntentReveal(segments, { active: Boolean(blocks.length), getStepDelay, generationKey });

  useEffect(() => {
    onGeneratingChange?.(reveal.isGenerating);
  }, [onGeneratingChange, reveal.isGenerating]);

  return <IntentRevealContext.Provider value={reveal}>{children}</IntentRevealContext.Provider>;
}

export function useIntentRevealState() {
  return useContext(IntentRevealContext);
}

export function useSegmentVisible(segment) {
  const reveal = useIntentRevealState();
  const visible = reveal?.isVisible(segment) ?? false;
  return {
    visible,
    active: reveal?.isActive?.(segment) ?? false,
    reducedMotion: reveal?.reducedMotion ?? false,
  };
}

export function IntentRevealItem({ segment, className = "", variant = "block", children }) {
  const { visible, active, reducedMotion } = useSegmentVisible(segment);
  const shown = visible || reducedMotion;

  return (
    <div
      className={[
        "intent-reveal-item",
        `intent-reveal-item--${variant}`,
        shown ? "is-visible" : "is-pending",
        active ? "is-active" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-hidden={!shown}
      data-intent-segment={segment}
    >
      <div className="intent-reveal-inner">{children}</div>
    </div>
  );
}

export function StreamingText({ text, className = "", charMs = 16, startDelayMs = 120, as: Tag = "p" }) {
  const reveal = useIntentRevealState();
  const reducedMotion = reveal?.reducedMotion;
  const active = reveal?.isActive?.("intro") || reveal?.isVisible?.("intro");
  const [visible, setVisible] = useState(reducedMotion ? text.length : 0);

  useEffect(() => {
    if (!text) {
      setVisible(0);
      return undefined;
    }

    if (reducedMotion) {
      setVisible(text.length);
      return undefined;
    }

    if (!active) {
      setVisible(0);
      return undefined;
    }

    setVisible(0);
    let index = 0;
    let typingTimer;
    const startTimer = setTimeout(() => {
      typingTimer = setInterval(() => {
        index += 1;
        setVisible(index);
        if (index >= text.length) clearInterval(typingTimer);
      }, charMs);
    }, startDelayMs);

    return () => {
      clearTimeout(startTimer);
      clearInterval(typingTimer);
    };
  }, [text, charMs, startDelayMs, reducedMotion, active]);

  if (!text) return null;

  const done = visible >= text.length;

  return (
    <Tag className={`intent-stream-text ${className}`.trim()}>
      {text.slice(0, visible)}
      {!done ? <span className="intent-stream-cursor" aria-hidden="true" /> : null}
    </Tag>
  );
}
