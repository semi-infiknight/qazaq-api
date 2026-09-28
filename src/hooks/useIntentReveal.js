import { useEffect, useRef, useState } from "react";

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return reduced;
}

export function defaultIntentStepDelay(prevSegment, nextSegment) {
  if (nextSegment?.startsWith("api-")) return 280;
  if (nextSegment?.startsWith("feature-")) return 780;
  if (nextSegment === "intro") return 520;
  if (nextSegment?.startsWith("trunk-")) return 520;
  return 560;
}

export function useIntentReveal(
  segments,
  { active = true, startMs = 220, getStepDelay = defaultIntentStepDelay, generationKey } = {},
) {
  const reducedMotion = useReducedMotion();
  const [step, setStep] = useState(-1);
  const lastKeyRef = useRef(undefined);
  const completedRef = useRef(false);

  const alreadyDone =
    completedRef.current &&
    generationKey !== undefined &&
    lastKeyRef.current === generationKey;

  useEffect(() => {
    if (!active || !segments.length) {
      setStep(-1);
      return undefined;
    }

    if (reducedMotion) {
      setStep(segments.length - 1);
      return undefined;
    }

    if (alreadyDone) {
      setStep(segments.length - 1);
      return undefined;
    }

    lastKeyRef.current = generationKey;
    completedRef.current = false;
    setStep(-1);
    const timers = [];
    let current = -1;

    const advance = () => {
      current += 1;
      setStep(current);
      if (current < segments.length - 1) {
        const delay = getStepDelay(segments[current], segments[current + 1], current);
        timers.push(setTimeout(advance, delay));
      } else {
        completedRef.current = true;
      }
    };

    timers.push(setTimeout(advance, startMs));
    return () => timers.forEach(clearTimeout);
  }, [active, segments, startMs, getStepDelay, reducedMotion, generationKey, alreadyDone]);

  const effectiveStep = alreadyDone ? segments.length - 1 : step;

  const isVisible = (segmentId) => {
    const index = segments.indexOf(segmentId);
    if (index === -1) return true;
    return effectiveStep >= index;
  };

  const isActive = (segmentId) => effectiveStep === segments.indexOf(segmentId);

  const isGenerating = effectiveStep >= 0 && effectiveStep < segments.length - 1;

  return {
    step: effectiveStep,
    segments,
    isVisible,
    isActive,
    isGenerating,
    reducedMotion,
  };
}
