import FeatureApiCard from "./FeatureApiCard.jsx";
import IntentViewToolbar from "./IntentViewToolbar.jsx";
import MermaidDiagram from "./MermaidDiagram.jsx";
import { IntentRevealItem, StreamingText } from "./intentReveal.jsx";
import { buildStackMermaid, formatProductLabel, intentViewMeta } from "./intentShared.js";
import { useMobileLayout } from "../../hooks/useMediaQuery.js";

function FeatureStepTitle({ block }) {
  return (
    <h3 className="intent-timeline-step-title">
      {block.parentLabel ? (
        <>
          <span className="intent-feature-parent">{block.parentLabel}</span>
          <span className="intent-feature-sep"> / </span>
        </>
      ) : null}
      {block.label}
    </h3>
  );
}

function FeatureStepMeta({ block }) {
  return (
    <>
      {block.why ? (
        <p className="intent-feature-why">
          <span className="intent-feature-label">Why</span> {block.why}
        </p>
      ) : null}
      {block.where ? (
        <p className="intent-feature-where">
          <span className="intent-feature-label">Where</span> {block.where}
        </p>
      ) : null}
    </>
  );
}

export default function IntentTimelineView({ suggestion, blocks }) {
  const isMobile = useMobileLayout();
  const chart = buildStackMermaid(suggestion, { direction: isMobile ? "TB" : "LR" });
  const productLabel = formatProductLabel(suggestion?.query);

  return (
    <div className="intent-view intent-view--timeline">
      <IntentRevealItem segment="canvas">
        <IntentViewToolbar label="Timeline" meta={intentViewMeta(blocks)} />
      </IntentRevealItem>

      <IntentRevealItem segment="diagram">
        <div className="intent-view-canvas intent-view-canvas--diagram intent-timeline-diagram">
          <section className="intent-prompt-diagram intent-prompt-diagram--inset" aria-label="Architecture diagram">
            <MermaidDiagram chart={chart} />
          </section>
        </div>
      </IntentRevealItem>

      <ol className="intent-timeline-list">
        <li className="intent-timeline-step">
          <IntentRevealItem segment="intro" variant="timeline">
            <div className="intent-timeline-rail" aria-hidden="true">
              <span className="intent-timeline-marker intent-timeline-marker--app">0</span>
              <span className="intent-timeline-line" />
            </div>
            <div className="intent-timeline-panel intent-view-panel">
              <p className="intent-view-panel-kicker">{productLabel}</p>
              {suggestion.summary ? (
                <StreamingText text={suggestion.summary} className="intent-view-summary intent-view-summary--timeline" />
              ) : (
                <p className="intent-view-summary intent-view-summary--timeline intent-view-summary--muted">
                  Matched Kazakhstan APIs for your product intent.
                </p>
              )}
            </div>
          </IntentRevealItem>
        </li>

        {blocks.map((block, index) => (
          <li key={block.id} className="intent-timeline-step">
            <IntentRevealItem segment={`feature-${index}`} variant="timeline">
              <div className="intent-timeline-rail" aria-hidden="true">
                <span className="intent-timeline-marker">{index + 1}</span>
                {index < blocks.length - 1 ? <span className="intent-timeline-line" /> : null}
              </div>
              <div className="intent-timeline-panel intent-timeline-panel--feature intent-view-panel">
                <p className="intent-timeline-step-kicker">
                  Step {index + 1} · {block.apis.length} API{block.apis.length === 1 ? "" : "s"}
                </p>
                <FeatureStepTitle block={block} />
                <FeatureStepMeta block={block} />
                <div className="intent-prompt-api-grid intent-timeline-api-grid">
                  {block.apis.map((api, apiIndex) => (
                    <IntentRevealItem
                      key={`${block.id}-${api.id}`}
                      segment={`api-${index}-${apiIndex}`}
                      variant="inline"
                    >
                      <FeatureApiCard api={api} feature={block} />
                    </IntentRevealItem>
                  ))}
                </div>
              </div>
            </IntentRevealItem>
          </li>
        ))}
      </ol>
    </div>
  );
}
