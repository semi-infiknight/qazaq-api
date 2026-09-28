import { useLayoutEffect, useState } from "react";
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

export function useFlowEdgePaths(stageRef, pairs, deps = [], pairReady = () => true) {
  const [paths, setPaths] = useState([]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const measure = () => {
      const stacked = window.matchMedia(MOBILE_LAYOUT_QUERY).matches;

      const next = pairs
        .map((pair, index) => {
          if (!pairReady(pair)) return null;

          const { getFrom, getTo, kind = "spine", tone = "feature" } = pair;
          const fromEl = getFrom?.();
          const toEl = getTo?.();
          if (!fromEl || !toEl) return null;

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

      setPaths(next);
    };

    measure();
    const afterReveal = window.setTimeout(measure, 780);
    const ro = new ResizeObserver(measure);
    ro.observe(stage);
    window.addEventListener("resize", measure);
    return () => {
      window.clearTimeout(afterReveal);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
    // pairReady is stable; reveal step is passed via deps
  }, [stageRef, pairs, ...deps]);

  return paths;
}
