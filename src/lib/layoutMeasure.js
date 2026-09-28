/** Collect scrollable ancestors plus window for layout remeasure hooks. */
export function collectScrollTargets(el, extraRefs = []) {
  const targets = [];
  const seen = new Set();

  const add = (node) => {
    if (!node || seen.has(node)) return;
    seen.add(node);
    targets.push(node);
  };

  for (const ref of extraRefs) {
    add(ref?.current);
  }

  let node = el;
  while (node) {
    const { overflowX, overflowY } = getComputedStyle(node);
    if (/(auto|scroll|overlay)/.test(overflowX) || /(auto|scroll|overlay)/.test(overflowY)) {
      add(node);
    }
    node = node.parentElement;
  }

  if (typeof window !== "undefined") {
    add(window);
  }

  return targets;
}

/** rAF-throttled measure + scroll, resize, transition, and resize-observer hooks. */
export function bindLayoutMeasure(root, measure, { extraScrollRefs = [] } = {}) {
  if (!root) return () => {};

  let rafId = 0;
  const schedule = () => {
    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(measure);
  };

  const scrollTargets = collectScrollTargets(root, extraScrollRefs);
  for (const target of scrollTargets) {
    target.addEventListener("scroll", schedule, { passive: true });
  }

  const onTransitionEnd = (event) => {
    if (event.target === root || event.target.closest?.(".intent-reveal-item")) {
      schedule();
    }
  };
  root.addEventListener("transitionend", onTransitionEnd);
  window.addEventListener("resize", schedule);

  const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(schedule) : null;
  ro?.observe(root);

  return () => {
    cancelAnimationFrame(rafId);
    for (const target of scrollTargets) {
      target.removeEventListener("scroll", schedule);
    }
    root.removeEventListener("transitionend", onTransitionEnd);
    window.removeEventListener("resize", schedule);
    ro?.disconnect();
  };
}
