import { useCallback, useMemo, useRef } from "react";
import FeatureApiCard from "./FeatureApiCard.jsx";
import IntentViewToolbar from "./IntentViewToolbar.jsx";
import PostmanFlowNode from "./PostmanFlowNode.jsx";
import { IntentRevealItem, StreamingText, useIntentRevealState } from "./intentReveal.jsx";
import { useFlowEdgePaths } from "./useFlowEdgePaths.js";
import { formatProductLabel, intentViewMeta } from "./intentShared.js";
import { useMobileLayout } from "../../hooks/useMediaQuery.js";

function flowSegmentSettled(reveal, segmentId) {
  if (!reveal) return true;
  if (reveal.reducedMotion) return reveal.isVisible(segmentId);
  return reveal.isVisible(segmentId) && !reveal.isActive(segmentId);
}

function FlowSvgEdges({ paths }) {
  if (!paths.length) return null;

  return (
    <svg className="intent-flows-svg" aria-hidden="true">
      {paths.map((path) => (
        <path
          key={path.id}
          d={path.d}
          className={`intent-flows-edge intent-flows-edge--${path.tone}`}
          fill="none"
        />
      ))}
    </svg>
  );
}

export default function IntentFlowsView({ suggestion, blocks }) {
  const isMobile = useMobileLayout();
  const reveal = useIntentRevealState();
  const stageRef = useRef(null);
  const startRef = useRef(null);
  const featureRefs = useRef([]);
  const branchRefs = useRef([]);

  const edgePairs = useMemo(() => {
    const pairs = [];
    if (blocks.length) {
      pairs.push({
        getFrom: () => startRef.current,
        getTo: () => featureRefs.current[0],
        kind: "spine",
        tone: "start",
        fromSegment: "intro",
        toSegment: "feature-0",
      });
    }
    blocks.forEach((block, index) => {
      if (index < blocks.length - 1) {
        pairs.push({
          getFrom: () => featureRefs.current[index],
          getTo: () => featureRefs.current[index + 1],
          kind: "spine",
          tone: "feature",
          fromSegment: `feature-${index}`,
          toSegment: `feature-${index + 1}`,
        });
      }
      pairs.push({
        getFrom: () => featureRefs.current[index],
        getTo: () => branchRefs.current[index],
        kind: "branch",
        tone: "api",
        fromSegment: `feature-${index}`,
        toSegment: `feature-${index}`,
      });
    });
    return pairs;
  }, [blocks]);

  const revealRef = useRef(reveal);
  revealRef.current = reveal;

  const pairReady = useCallback((pair) => {
    const r = revealRef.current;
    return flowSegmentSettled(r, pair.fromSegment) && flowSegmentSettled(r, pair.toSegment);
  }, []);

  const paths = useFlowEdgePaths(stageRef, edgePairs, [blocks.length, reveal?.step], pairReady);

  const productLabel = formatProductLabel(suggestion?.query);

  return (
    <div className="intent-view intent-view--flows intent-flows">
      <div className="intent-view-canvas intent-flows-stage" ref={stageRef}>
        <IntentViewToolbar label="Integration flow" meta={intentViewMeta(blocks)} />
        <FlowSvgEdges paths={paths} />

        <div className={`intent-flows-spine${isMobile ? " intent-flows-spine--stacked" : ""}`}>
          <div className="intent-flows-col intent-flows-col--start">
            <IntentRevealItem segment="intro">
              <PostmanFlowNode
                nodeRef={startRef}
                type="start"
                title={productLabel}
                subtitle="Product"
                fields={[]}
              />
              {suggestion.summary ? (
                <div className="intent-flows-start-note">
                  <StreamingText text={suggestion.summary} className="intent-view-summary" />
                </div>
              ) : null}
            </IntentRevealItem>
          </div>

          {blocks.map((block, index) => (
            <div key={block.id} className="intent-flows-col">
              <IntentRevealItem segment={`feature-${index}`}>
                <PostmanFlowNode
                  nodeRef={(el) => {
                    featureRefs.current[index] = el;
                  }}
                  type="feature"
                  stepIndex={index + 1}
                  title={block.label}
                  subtitle={block.parentLabel || "Product capability"}
                  fields={[
                    block.why ? { label: "Why", value: block.why } : null,
                    block.where ? { label: "Where", value: block.where } : null,
                    {
                      label: "Matches",
                      value: block.apis.length === 1 ? "1 catalogue API" : `${block.apis.length} catalogue APIs`,
                      badge: String(block.apis.length),
                      badgeTone: "accent",
                    },
                  ].filter(Boolean)}
                />

                <div
                  className="intent-flows-branch intent-flows-branch-panel"
                  ref={(el) => {
                    branchRefs.current[index] = el;
                  }}
                >
                  <p className="intent-view-branch-kicker">
                    <span className="intent-view-branch-dot intent-view-branch-dot--success" />
                    API options
                  </p>
                  <div className="intent-prompt-api-grid intent-flows-api-grid">
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
