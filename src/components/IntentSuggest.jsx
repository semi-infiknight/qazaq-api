import IntentFlowsView from "./intent/IntentFlowsView.jsx";
import { IntentRevealProvider, useIntentRevealState } from "./intent/intentReveal.jsx";
import { featureBlocks, formatProductLabel } from "./intent/intentShared.js";

export { featureBlocks, formatProductLabel };

function IntentPromptHeader({ blocks, suggestion }) {
  const reveal = useIntentRevealState();
  const apiTotal = blocks.reduce((n, b) => n + (b.apis?.length || 0), 0);
  const revealedFeatures = blocks.filter((_, index) => reveal?.isVisible(`feature-${index}`)).length;
  const revealedApis = blocks.reduce((count, block, blockIndex) => {
    if (!reveal) return count;
    return (
      count +
      block.apis.filter((_, apiIndex) => reveal.isVisible(`api-${blockIndex}-${apiIndex}`)).length
    );
  }, 0);

  const featureLabel =
    reveal?.isGenerating && revealedFeatures < blocks.length
      ? `${revealedFeatures}/${blocks.length} features`
      : `${blocks.length} features`;
  const apiLabel =
    reveal?.isGenerating && revealedApis < apiTotal
      ? `${revealedApis}/${apiTotal} APIs`
      : `${apiTotal} APIs`;

  return (
    <header className="intent-prompt-head">
      <div>
        <p className="intent-prompt-role">
          {reveal?.isGenerating ? "Finding integrations" : "Suggested integrations"}
          {reveal?.isGenerating ? <span className="intent-generating-dot" aria-hidden="true" /> : null}
        </p>
        <p className="intent-prompt-meta">
          {featureLabel} · {apiLabel}
        </p>
      </div>
    </header>
  );
}

function IntentPromptShell({ blocks, suggestion, children }) {
  const reveal = useIntentRevealState();

  return (
    <article
      className={`panel intent-prompt${reveal?.isGenerating ? " is-generating" : ""}`}
      aria-label="Suggested API integrations"
    >
      <IntentPromptHeader blocks={blocks} suggestion={suggestion} />
      {children}
    </article>
  );
}

function IntentNoApisMatched({ suggestion, blocks }) {
  return (
    <article className="panel intent-prompt intent-prompt--no-apis" aria-label="Identified features without KZ APIs">
      <header className="intent-prompt-head">
        <div>
          <p className="intent-prompt-role">Features understood</p>
          <p className="intent-prompt-meta">
            {blocks.length} feature{blocks.length === 1 ? "" : "s"} · 0 KZ APIs
          </p>
        </div>
      </header>
      <p className="intent-prompt-body">
        {suggestion.summary ||
          `We identified product features for “${suggestion.query}” but no strong Kazakhstan commercial APIs exist for them yet.`}
      </p>
      <ul className="intent-no-apis-list">
        {blocks.map((block) => (
          <li key={block.id} className="intent-no-apis-card">
            <div className="intent-no-apis-card-head">
              <h3 className="intent-no-apis-card-title">
                {block.parentLabel ? (
                  <>
                    <span className="intent-feature-parent">{block.parentLabel}</span>
                    <span className="intent-feature-sep"> / </span>
                  </>
                ) : null}
                {block.label}
              </h3>
              <span className="intent-no-apis-badge">No KZ API yet</span>
            </div>
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
          </li>
        ))}
      </ul>
      <p className="intent-prompt-nofit-hint">
        Qazaq Stack covers KZ payments, maps, delivery, banking, travel, weather, telecom, and government open data.
        These features are not in the catalogue yet.
      </p>
    </article>
  );
}

function IntentResultsBody({ suggestion, onGeneratingChange }) {
  const blocks = featureBlocks(suggestion);

  if (!suggestion?.query) return null;

  if (suggestion.reason === "no_apis_matched" && blocks.length) {
    return <IntentNoApisMatched suggestion={suggestion} blocks={blocks} />;
  }

  if (suggestion.fit === false || (!blocks.length && !suggestion?.apis?.length)) {
    return (
      <div className="panel intent-prompt intent-prompt--empty">
        <p className="intent-prompt-body">
          {suggestion.summary ||
            `We don’t have a good API fit for “${suggestion.query}” in the Kazakhstan catalogue.`}
        </p>
        <p className="intent-prompt-nofit-hint">
          This directory covers KZ payments, maps, delivery, banking, travel, weather, telecom, and government open
          data — not every product idea worldwide.
        </p>
      </div>
    );
  }

  return (
    <IntentRevealProvider blocks={blocks} summary={suggestion.summary || ""} onGeneratingChange={onGeneratingChange}>
      <IntentPromptShell blocks={blocks} suggestion={suggestion}>
        <div className="intent-view-pane">
          <IntentFlowsView suggestion={suggestion} blocks={blocks} />
        </div>
      </IntentPromptShell>
    </IntentRevealProvider>
  );
}

export function IntentResults({ suggestion, onGeneratingChange }) {
  return <IntentResultsBody suggestion={suggestion} onGeneratingChange={onGeneratingChange} />;
}
