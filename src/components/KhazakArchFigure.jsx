import { useEffect, useRef } from "react";
import KhanShatyrAnimated from "./KhanShatyrAnimated.jsx";
import KhazakArchWallRows from "./KhazakArchWallRows.jsx";
import { formatCatalogueCaption } from "../lib/site.js";
import { KZ_ARCH_AGENTS, KZ_ARCH_ALLOWS } from "../data/kzArchCalls.js";
import { KZ_ARCH_TILES } from "../data/kzArchTiles.js";
import {
  alignTrackToSlug,
  pauseRowTrack,
  resolveArchWallSlug,
  resumeRowTrack,
  rowIndexForSlug,
} from "../lib/kzArchWall.js";

function schedule(queue, ms, fn, alive) {
  const id = setTimeout(() => {
    queue.delete(id);
    if (alive.current) fn();
  }, ms);
  queue.add(id);
  return id;
}

function runTimeline(steps, alive) {
  const queue = new Set();
  let at = 0;
  steps.forEach(([delay, fn]) => {
    at += delay;
    schedule(queue, at, fn, alive);
  });
  return { queue, total: at };
}

function tileCenter(tile, stage, offsetX = 0, offsetY = 0) {
  const rect = tile.getBoundingClientRect();
  const stageRect = stage.getBoundingClientRect();
  return {
    x: rect.left - stageRect.left + rect.width / 2 + offsetX,
    y: rect.top - stageRect.top + rect.height / 2 + offsetY,
  };
}

function movePill(pill, point) {
  pill.style.transform = `translate(${point.x}px, ${point.y}px) translate(-50%, -50%)`;
}

function movePillBeside(pill, point) {
  pill.style.transform = `translate(${point.x}px, ${point.y}px) translate(0, -50%)`;
}

function snapPill(pill, point, beside = false) {
  pill.style.transition = "none";
  if (beside) movePillBeside(pill, point);
  else movePill(pill, point);
  pill.offsetWidth;
  pill.style.transition = "";
}

function animatePill(pill, point, ms, beside = false) {
  pill.style.transitionDuration = `0.35s, ${ms}ms, 0.4s, 0.4s`;
  if (beside) movePillBeside(pill, point);
  else movePill(pill, point);
}

function drawBeam(beam, from, to, ms, tone = "") {
  beam.setAttribute("d", `M${from.x} ${from.y}L${to.x} ${to.y}`);
  beam.setAttribute(
    "class",
    `kz-af-beam ${beam.classList.contains("kz-af-beam-b") ? "kz-af-beam-b" : "kz-af-beam-a"} ${tone}`.trim(),
  );
  beam.style.transition = "none";
  beam.style.strokeDashoffset = "1";
  beam.style.opacity = "1";
  beam.getBoundingClientRect();
  beam.style.transition = `stroke-dashoffset ${ms}ms cubic-bezier(0.4,0,0.2,1), opacity 0.45s ease, stroke 0.4s ease, filter 0.4s ease`;
  beam.style.strokeDashoffset = "0";
}

function setBeamTone(beam, tone) {
  beam.setAttribute(
    "class",
    `kz-af-beam ${beam.classList.contains("kz-af-beam-b") ? "kz-af-beam-b" : "kz-af-beam-a"} ${tone}`.trim(),
  );
}

function hideBeam(beam) {
  beam.style.opacity = "0";
}

function hidePill(pill) {
  pill.classList.remove("kz-af-vis");
}

function svgPoint(svg, vx, vy, stage) {
  const stageRect = stage.getBoundingClientRect();
  const pt = svg.createSVGPoint();
  pt.x = vx;
  pt.y = vy;
  const screen = pt.matrixTransform(svg.getScreenCTM());
  return {
    x: screen.x - stageRect.left,
    y: screen.y - stageRect.top,
  };
}

function anchorPoint(svg, selector, stage, fallback) {
  const node = svg.querySelector(selector);
  if (!node) return fallback;
  const cx = Number(node.getAttribute("cx"));
  const cy = Number(node.getAttribute("cy"));
  if (!Number.isFinite(cx) || !Number.isFinite(cy)) return fallback;
  return svgPoint(svg, cx, cy, stage);
}

function spireChipPoint(spire) {
  return {
    x: spire.x + 18,
    y: spire.y + 3,
  };
}

export default function KhazakArchFigure({ catalogueTotal = 723 }) {
  const rootRef = useRef(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;

    aliveRef.current = true;
    const timers = new Set();
    const alive = aliveRef;

    const q = (sel) => {
      const node = root.querySelector(sel);
      if (!node) throw new Error(`KhazakArchFigure: missing ${sel}`);
      return node;
    };

    const stage = q(".kz-af-stage");
    const wires = q(".kz-af-wires");
    const fan = q(".kz-af-fan");
    const beamA = q(".kz-af-beam-a");
    const beamB = q(".kz-af-beam-b");
    const hub = q(".kz-af-hub");
    const capAgents = q(".kz-af-cap-agents");
    const capApis = q(".kz-af-cap-apis");
    const chip = q(".kz-af-chip");
    const chipText = q(".kz-af-chip-t");
    const keyBadge = q(".kz-af-key");
    const retPill = q(".kz-af-ret");
    const slots = Array.from(root.querySelectorAll(".kz-af-slot"));
    const wallRows = Array.from(root.querySelectorAll(".kz-af-wall-row"));
    const wallTracks = Array.from(root.querySelectorAll(".kz-af-wall-track"));

    let visible = false;
    let cycling = false;
    let cycleIndex = 0;
    let activeSlot = slots[0];
    let activeTile = null;
    let pausedRow = null;

    const layout = {
      stacked: false,
      hubIn: { x: 0, y: 0 },
      hubOut: { x: 0, y: 0 },
      spire: { x: 0, y: 0 },
      hub: { left: 0, right: 0, top: 0, bottom: 0 },
      slots: [],
      target: { x: 0, y: 0 },
    };

    const releasePausedRow = () => {
      if (!pausedRow) return;
      wallRows[pausedRow.index]?.classList.remove("kz-af-row-lit");
      resumeRowTrack(pausedRow.track, pausedRow.anim);
      pausedRow = null;
    };

    const prepareTarget = (call) => {
      releasePausedRow();
      const wallSlug = resolveArchWallSlug(call.slug, KZ_ARCH_TILES);
      const rowIndex = rowIndexForSlug(KZ_ARCH_TILES, wallSlug);
      const rowEl = wallRows[rowIndex];
      const track = wallTracks[rowIndex];
      if (!rowEl || !track) return;

      rowEl.classList.add("kz-af-row-lit");
      const anim = pauseRowTrack(track);
      activeTile = alignTrackToSlug(rowEl, track, wallSlug, call.align ?? 0.5);
      pausedRow = { track, anim, index: rowIndex, call };
      measure();
    };

    const measure = () => {
      const stageRect = stage.getBoundingClientRect();
      const hubRect = hub.getBoundingClientRect();
      const inlineSvg = hub.querySelector(".ks-inline-svg");
      layout.stacked = window.matchMedia("(max-width: 860px)").matches;
      wires.setAttribute("viewBox", `0 0 ${Math.round(stageRect.width)} ${Math.round(stageRect.height)}`);

      layout.hub = {
        left: hubRect.left - stageRect.left,
        right: hubRect.right - stageRect.left,
        top: hubRect.top - stageRect.top,
        bottom: hubRect.bottom - stageRect.top,
      };

      const fallbackIn = layout.stacked
        ? { x: (layout.hub.left + layout.hub.right) / 2, y: layout.hub.top + layout.hub.bottom * 0.72 }
        : { x: layout.hub.left + hubRect.width * 0.18, y: layout.hub.top + hubRect.height * 0.78 };
      const fallbackSpire = layout.stacked
        ? { x: (layout.hub.left + layout.hub.right) / 2, y: layout.hub.top + hubRect.height * 0.08 }
        : { x: layout.hub.left + hubRect.width * 0.68, y: layout.hub.top + hubRect.height * 0.06 };
      const fallbackOut = layout.stacked
        ? { x: (layout.hub.left + layout.hub.right) / 2, y: layout.hub.top + hubRect.height * 0.1 }
        : { x: layout.hub.left + hubRect.width * 0.72, y: layout.hub.top + hubRect.height * 0.1 };

      if (inlineSvg) {
        layout.hubIn = anchorPoint(inlineSvg, ".ks-af-anchor-in", stage, fallbackIn);
        layout.spire = anchorPoint(inlineSvg, ".ks-af-anchor-spire", stage, fallbackSpire);
        layout.hubOut = anchorPoint(inlineSvg, ".ks-af-anchor-out", stage, fallbackOut);
      } else {
        layout.hubIn = fallbackIn;
        layout.spire = fallbackSpire;
        layout.hubOut = fallbackOut;
      }

      layout.slots = slots.map((slot) => {
        const rect = slot.getBoundingClientRect();
        return layout.stacked
          ? { x: rect.left - stageRect.left + rect.width / 2, y: rect.bottom - stageRect.top + 5 }
          : { x: rect.right - stageRect.left + 5, y: rect.top - stageRect.top + rect.height / 2 };
      });

      if (activeTile) {
        const raw = tileCenter(activeTile, stage);
        const padX = Math.max(24, stageRect.width * 0.04);
        const padY = Math.max(18, stageRect.height * 0.04);
        layout.target = {
          x: Math.min(Math.max(raw.x, padX), stageRect.width - padX),
          y: Math.min(Math.max(raw.y, padY), stageRect.height - padY),
        };
      }

      fan.setAttribute(
        "d",
        layout.slots
          .map((point) =>
            layout.stacked
              ? `M${point.x} ${point.y}L${point.x} ${layout.hubIn.y}`
              : `M${point.x} ${point.y}L${layout.hubIn.x} ${layout.hubIn.y}`,
          )
          .join(""),
      );
    };

    const resetVisual = () => {
      [chip, retPill].forEach(hidePill);
      [beamA, beamB].forEach(hideBeam);
      hub.classList.remove("kz-af-hot-a", "kz-af-routing");
      capAgents.classList.remove("kz-af-lit");
      capApis.classList.remove("kz-af-lit");
      keyBadge.classList.remove("kz-af-show");
      slots.forEach((slot) => slot.classList.remove("kz-af-calling"));
      root.querySelectorAll(".kz-af-tile").forEach((tile) => tile.classList.remove("kz-af-bloom"));
      releasePausedRow();
      activeTile = null;
    };

    const runCycle = () => {
      cycling = true;
      const allow = KZ_ARCH_ALLOWS[cycleIndex % KZ_ARCH_ALLOWS.length];
      activeSlot = slots[cycleIndex % slots.length];
      cycleIndex += 1;
      measure();

      const slotPoint = layout.slots[slots.indexOf(activeSlot)];
      const spirePoint = () => spireChipPoint(layout.spire);

      const steps = [
        [0, () => {
          activeSlot.classList.add("kz-af-calling");
          capAgents.classList.add("kz-af-lit");
        }],
        [520, () => {
          chipText.textContent = `${allow.method} ${allow.path}`;
          keyBadge.classList.remove("kz-af-show");
          snapPill(chip, slotPoint);
          chip.classList.add("kz-af-vis");
        }],
        [260, () => {
          drawBeam(beamA, slotPoint, layout.hubIn, 900);
          animatePill(chip, layout.hubIn, 900);
          hub.classList.add("kz-af-hot-a", "kz-af-routing");
        }],
        [940, () => {
          snapPill(chip, spirePoint(), true);
          keyBadge.classList.add("kz-af-show");
          setBeamTone(beamA, "kz-af-b-amber");
          hub.classList.remove("kz-af-routing");
        }],
        [760, () => {
          prepareTarget(allow);
          drawBeam(beamB, layout.hubOut, layout.target, 900);
          animatePill(chip, layout.target, 900);
          hub.classList.remove("kz-af-hot-a");
          keyBadge.classList.remove("kz-af-show");
        }],
        [640, () => hidePill(chip)],
        [260, () => {
          activeTile?.classList.add("kz-af-bloom");
          capApis.classList.add("kz-af-lit");
        }],
        [620, () => {
          retPill.textContent = allow.status;
          setBeamTone(beamA, "kz-af-b-green");
          setBeamTone(beamB, "kz-af-b-green");
          snapPill(retPill, layout.target);
          retPill.classList.add("kz-af-vis");
          animatePill(retPill, spirePoint(), 950, true);
        }],
        [520, () => hidePill(retPill)],
        [420, () => {
          activeTile?.classList.remove("kz-af-bloom");
          releasePausedRow();
          hideBeam(beamA);
          hideBeam(beamB);
          activeSlot.classList.remove("kz-af-calling");
          capAgents.classList.remove("kz-af-lit");
          capApis.classList.remove("kz-af-lit");
        }],
      ];

      const { total } = runTimeline(steps, alive);
      schedule(timers, total + 1200, () => {
        if (visible) runCycle();
        else cycling = false;
      }, alive);
    };

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let observer;
    let resizeTimer;

    const cleanup = () => {
      alive.current = false;
      timers.forEach((id) => clearTimeout(id));
      observer?.disconnect();
      window.removeEventListener("resize", onResize);
      clearTimeout(resizeTimer);
      root.classList.remove("kz-af-on");
      resetVisual();
    };

    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (alive.current) {
          if (pausedRow?.call) prepareTarget(pausedRow.call);
          else measure();
        }
      }, 160);
    };

    measure();

    if (reduced) {
      root.classList.add("kz-af-on");
      const seed = KZ_ARCH_ALLOWS[0];
      prepareTarget(seed);
      measure();
      activeSlot = slots[1] ?? slots[0];
      activeSlot.classList.add("kz-af-calling");
      const slotPoint = layout.slots[slots.indexOf(activeSlot)];
      drawBeam(beamA, slotPoint, layout.hubIn, 0, "kz-af-b-amber");
      drawBeam(beamB, layout.hubOut, layout.target, 0, "kz-af-b-green");
      activeTile?.classList.add("kz-af-bloom");
      capAgents.classList.add("kz-af-lit");
      capApis.classList.add("kz-af-lit");
      keyBadge.classList.add("kz-af-show");
      chipText.textContent = `${seed.method} ${seed.path}`;
      snapPill(chip, spireChipPoint(layout.spire), true);
      chip.classList.add("kz-af-vis");
      wallTracks.forEach((track) => pauseRowTrack(track));
      return cleanup;
    }

    let started = false;
    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visible = entry.isIntersecting;
          if (!visible) continue;
          if (started) {
            if (!cycling) {
              cycling = true;
              schedule(timers, 300, runCycle, alive);
            }
          } else {
            started = true;
            cycling = true;
            root.classList.add("kz-af-on");
            schedule(timers, 900, runCycle, alive);
          }
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(root);
    window.addEventListener("resize", onResize);
    return cleanup;
  }, []);

  return (
    <figure ref={rootRef} className="kz-af" role="img" aria-label="Agent requests flow through Qazaq Stack to Kazakhstan providers">
      <div className="kz-af-stage" aria-hidden="true">
        <svg className="kz-af-wires" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path className="kz-af-fan" />
          <path className="kz-af-beam kz-af-beam-a" pathLength="1" />
          <path className="kz-af-beam kz-af-beam-b" pathLength="1" />
        </svg>

        <span className="kz-af-cap kz-af-cap-agents">any agent</span>
        <span className="kz-af-cap kz-af-cap-apis">{formatCatalogueCaption(catalogueTotal)}</span>

        <div className="kz-af-agents">
          {KZ_ARCH_AGENTS.map((mask) => (
            <span key={mask} className="kz-af-slot">
              <span
                className="kz-af-glyph"
                style={{
                  maskImage: `url(${mask})`,
                  WebkitMaskImage: `url(${mask})`,
                }}
              />
            </span>
          ))}
        </div>

        <div className="kz-af-hub">
          <KhanShatyrAnimated className="kz-af-hub-art" align="center" />
        </div>

        <div className="kz-af-fieldwrap">
          <KhazakArchWallRows />
        </div>

        <div className="kz-af-pill kz-af-chip">
          <span className="kz-af-chip-t" />
          <span className="kz-af-key">key_████</span>
        </div>
        <div className="kz-af-pill kz-af-ret" />
      </div>
    </figure>
  );
}
