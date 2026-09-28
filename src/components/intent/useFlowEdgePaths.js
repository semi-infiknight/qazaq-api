import { useLayoutEffect, useRef, useState } from "react";
import { MOBILE_LAYOUT_QUERY } from "../../hooks/useMediaQuery.js";

function centerRight(el, root) {
  const r = el.getBoundingClientRect();
  const o = root.getBoundingClientRect();
  return { x: r.right - o.left, y: r.top - o.top + r.height / 2 };
}

function centerLeft(el, root) {
  const r = el.getBoundingClientRect();
  const o = root.getBoundingClientRect();
  return { x: r.left - o.left, y: r.top - o.top + r.height / 2 };
}

function topCenter(el, root) {
  const r = el.getBoundingClientRect();
  const o = root.getBoundingClientRect();
  return { x: r.left - o.left + r.width / 2, y: r.top - o.top };
}

function bottomCenter(el, root) {
  const r = el.getBoundingClientRect();
  const o = root.getBoundingClientRect();
  return { x: r.left - o.left + r.width / 2, y: r.bottom - o.top };
}

function bezierPath(from, to, bend = 0.45) {
  const dx = to.x - from.x;
  const c1x = from.x + dx * bend;
  const c2x = to.x - dx * bend;
  return `M ${from.x} ${from.y} C ${c1x} ${from.y}, ${c2x} ${to.y}, ${to.x} ${to.y}`;
}

function verticalBezierPath(from, to, bend = 0.45) {
  const dy = to.y - from.y;
  const c1y = from.y + dy * bend;
  const c2y = to.y - dy * bend;
  return `M ${from.x} ${from.y} C ${from.x} ${c1y}, ${to.x} ${c2y}, ${to.x} ${to.y}`;
}

function branchPath(from, to, stacked) {
  if (stacked) {
    const midY = from.y + (to.y - from.y) * 0.35;
    return `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
  }
  const midY = from.y + (to.y - from.y) * 0.35;
  return `M ${from.x} ${from.y} C ${from.x} ${midY}, ${to.x} ${midY}, ${to.x} ${to.y}`;
}

function pathsEqual(a, b) {
  if (a.length !== b.length) return false;
  return a.every((path, index) => {
    const other = b[index];
    return path.id === other.id && path.d === other.d && path.tone === other.tone;
  });
}

export function useFlowEdgePaths(stageRef, pairs, deps = [], pairReady = () => true) {
  const [paths, setPaths] = useState([]);
  const pairReadyRef = useRef(pairReady);
  pairReadyRef.current = pairReady;

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let rafId = 0;

    const measure = () => {
      const stacked = window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
      const ready = pairReadyRef.current;

      const next = pairs
        .map((pair, index) => {
          if (!ready(pair)) return null;

          const { getFrom, getTo, kind = "spine", tone = "feature" } = pair;
          const fromEl = getFrom?.();
          const toEl = getTo?.();
          if (!fromEl || !toEl) return null;

          const fromRect = fromEl.getBoundingClientRect();
          const toRect = toEl.getBoundingClientRect();
          if (fromRect.width < 2 || fromRect.height < 2 || toRect.width < 2 || toRect.height < 2) {
            return null;
          }

          let from;
          let to;
          if (kind === "branch") {
            from = bottomCenter(fromEl, stage);
            to = topCenter(toEl, stage);
          } else if (stacked) {
            from = bottomCenter(fromEl, stage);
            to = topCenter(toEl, stage);
          } else {
            from = centerRight(fromEl, stage);
            to = centerLeft(toEl, stage);
          }

          return {
            d:
              kind === "branch"
                ? branchPath(from, to, stacked)
                : stacked
                  ? verticalBezierPath(from, to)
                  : bezierPath(from, to),
            tone,
            id: `edge-${index}`,
          };
        })
        .filter(Boolean);

      setPaths((prev) => (pathsEqual(prev, next) ? prev : next));
    };

    const scheduleMeasure = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(measure);
    };

    measure();
    const t1 = window.setTimeout(measure, 400);
    const t2 = window.setTimeout(measure, 820);
    const ro = new ResizeObserver(scheduleMeasure);
    ro.observe(stage);
    window.addEventListener("resize", scheduleMeasure);
    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      ro.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
    // pairReady is stable via ref; reveal step / generating passed via deps
  }, [stageRef, pairs, ...deps]);

  return paths;
}
