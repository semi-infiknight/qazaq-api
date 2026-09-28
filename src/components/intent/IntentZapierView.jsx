import { useMemo, useState } from "react";
import FeatureApiCard from "./FeatureApiCard.jsx";
import IntentViewToolbar from "./IntentViewToolbar.jsx";
import { IntentRevealItem, StreamingText } from "./intentReveal.jsx";
import { formatProductLabel, intentViewMeta } from "./intentShared.js";

function ZapierConnector() {
  return (
    <div className="intent-zapier-connector" aria-hidden="true">
      <span className="intent-zapier-connector-line" />
      <span className="intent-zapier-connector-plus">+</span>
      <span className="intent-zapier-connector-line" />
    </div>
  );
}

function ZapierStepCard({ stepNumber, title, kind, meta, active, onSelect, dark, streamMeta = false }) {
  const isTrigger = kind === "trigger";
  const isPaths = kind === "paths";

  return (
    <button
      type="button"
      className={[
        "intent-zapier-step",
        active ? "intent-zapier-step-active" : "",
        isTrigger ? "intent-zapier-step--trigger" : "",
        isPaths ? "intent-zapier-step--paths" : "",
        dark ? "intent-zapier-step--dark" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => onSelect?.(stepNumber)}
      aria-pressed={active}
    >
      <span className="intent-zapier-step-status" aria-hidden="true">
        ✓
      </span>
      <span className="intent-zapier-step-icon" aria-hidden="true">
        {isTrigger ? "⚡" : isPaths ? "⎇" : "▣"}
      </span>
      <span className="intent-zapier-step-copy">
        <span className="intent-zapier-step-head">
          <strong className="intent-zapier-step-title">
            {stepNumber}. {title}
          </strong>
          {isTrigger ? <span className="intent-zapier-step-badge">Trigger</span> : null}
        </span>
        {meta && streamMeta ? (
          <StreamingText text={meta} className="intent-zapier-step-meta" charMs={12} as="span" />
        ) : meta ? (
          <span className="intent-zapier-step-meta">{meta}</span>
        ) : null}
      </span>
    </button>
  );
}

function PathColumn({ pathLabel, block, stepBase, activeStep, onSelect, blockIndex }) {
  const rulesStep = stepBase;
  const actionStep = stepBase + 1;

  return (
    <IntentRevealItem segment={`feature-${blockIndex}`} className="intent-zapier-path-col">
      <span className="intent-zapier-path-label">{pathLabel}</span>

      <ZapierConnector />

      <ZapierStepCard
        stepNumber={rulesStep}
        title="Path rules"
        kind="rules"
        meta={block.why || `Continue when ${block.label} is required`}
        active={activeStep === rulesStep}
        onSelect={onSelect}
      />

      <ZapierConnector />

      <ZapierStepCard
        stepNumber={actionStep}
        title={block.label}
        kind="action"
        meta={block.parentLabel || "Feature action"}
        active={activeStep === actionStep}
        onSelect={onSelect}
      />

      {block.where ? (
        <p className="intent-zapier-path-note">
          <span className="intent-feature-label">Where</span> {block.where}
        </p>
      ) : null}

      <div className="intent-prompt-api-grid intent-zapier-api-grid">
        {block.apis.map((api, apiIndex) => (
          <IntentRevealItem key={`${block.id}-${api.id}`} segment={`api-${blockIndex}-${apiIndex}`} variant="inline">
            <FeatureApiCard api={api} feature={block} />
          </IntentRevealItem>
        ))}
      </div>
    </IntentRevealItem>
  );
}

export default function IntentZapierView({ suggestion, blocks }) {
  const [activeStep, setActiveStep] = useState(1);
  const productLabel = formatProductLabel(suggestion?.query);
  const pathLabels = useMemo(
    () => blocks.map((_, i) => String.fromCharCode(65 + i)),
    [blocks],
  );
  const pathStepBase = 4;

  return (
    <div className="intent-view intent-view--stack intent-zapier">
      <IntentRevealItem segment="canvas">
        <IntentViewToolbar label="Stack" meta={intentViewMeta(blocks)} />
      </IntentRevealItem>

      <div className="intent-view-canvas intent-zapier-chart" aria-label="Structured integration flowchart">
        <div className="intent-zapier-trunk">
          <IntentRevealItem segment="trunk-1">
            <ZapierStepCard
              stepNumber={1}
              title={productLabel}
              kind="trigger"
              active={activeStep === 1}
              onSelect={setActiveStep}
            />
          </IntentRevealItem>

          <IntentRevealItem segment="trunk-2">
            <ZapierConnector />
            <ZapierStepCard
              stepNumber={2}
              title="Only continue if…"
              kind="filter"
              meta={suggestion.summary || "Intent matches KZ catalogue features"}
              streamMeta={Boolean(suggestion.summary)}
              active={activeStep === 2}
              onSelect={setActiveStep}
            />
          </IntentRevealItem>

          <IntentRevealItem segment="trunk-3">
            <ZapierConnector />
            <ZapierStepCard
              stepNumber={3}
              title="Paths"
              kind="paths"
              meta={`Split stack into ${blocks.length} feature paths`}
              active={activeStep === 3}
              onSelect={setActiveStep}
              dark
            />

            <div className="intent-zapier-paths-rail" aria-hidden="true">
              <span className="intent-zapier-paths-rail-line" />
            </div>
          </IntentRevealItem>
        </div>

        <div
          className="intent-zapier-paths"
          style={{ "--path-count": Math.max(blocks.length, 1) }}
        >
          {blocks.map((block, index) => (
            <PathColumn
              key={block.id}
              pathLabel={`Path ${pathLabels[index]}`}
              block={block}
              stepBase={pathStepBase + index * 2}
              activeStep={activeStep}
              onSelect={setActiveStep}
              blockIndex={index}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
