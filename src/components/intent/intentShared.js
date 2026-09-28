export function shortApiLabel(title = "") {
  const base = title.split("~")[0].trim();
  return base.length > 26 ? `${base.slice(0, 24)}…` : base || "API";
}

const PRODUCT_PROMPT_PREFIXES = [
  /^i\s+(?:want|would like|need)\s+to\s+(?:build|make|create|launch)\s+(?:a\s+|an\s+|my\s+)?/i,
  /^i(?:'m|\s+am)\s+(?:building|making|creating|launching)\s+(?:a\s+|an\s+|my\s+)?/i,
  /^(?:help me\s+)?(?:build|make|create|launch)\s+(?:a\s+|an\s+|my\s+)?/i,
  /^(?:a\s+|an\s+)\s*/i,
];

const PRODUCT_NOUN = /\b(app|application|platform|portal|dashboard|marketplace|store|service|product|tool|bot|site|website)\b/i;

/** Turn a free-text intent prompt into a readable product name for flow UIs. */
export function formatProductLabel(query = "") {
  let text = String(query || "").trim();
  if (!text) return "Your product";

  for (const pattern of PRODUCT_PROMPT_PREFIXES) {
    text = text.replace(pattern, "");
  }

  text = text.replace(/^["'`]|["'`]$/g, "").replace(/[.!?…]+$/, "").trim();
  if (!text) return "Your product";

  if (!PRODUCT_NOUN.test(text)) {
    text = `${text} app`;
  }

  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

export function mermaidSafeId(value) {
  const id = String(value || "n")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return id || "n";
}

function escapeMermaidLabel(text) {
  return String(text || "")
    .replace(/"/g, "'")
    .replace(/[\[\]]/g, "")
    .replace(/\n/g, " ");
}

export function featureBlocks(suggestion) {
  return suggestion?.features?.length ? suggestion.features : suggestion?.intents || [];
}

export function intentViewMeta(blocks) {
  const featureCount = blocks.length;
  const apiCount = blocks.reduce((n, b) => n + (b.apis?.length || 0), 0);
  const features = `${featureCount} feature${featureCount === 1 ? "" : "s"}`;
  const apis = `${apiCount} API${apiCount === 1 ? "" : "s"}`;
  return `${features} · ${apis}`;
}

/** Build a stack flowchart from matched features (TB on mobile, LR on desktop). */
export function buildStackMermaid(suggestion, { direction = "LR" } = {}) {
  const blocks = featureBlocks(suggestion);
  if (!blocks.length) return "";

  const flow = direction === "TB" ? "flowchart TB" : "flowchart LR";
  const lines = [
    flow,
    `  App["${escapeMermaidLabel(formatProductLabel(suggestion?.query))}"]`,
    "  classDef app fill:#1a1025,stroke:#c76a3a,color:#f0ebe3,stroke-width:1.5px",
    "  classDef layer fill:#141018,stroke:#8a5c40,color:#e8dfd6,stroke-width:1px",
    "  classDef api fill:#0d0a10,stroke:#4a3d38,color:#d0c8c0,stroke-width:1px",
    "  class App app",
  ];

  blocks.forEach((block, index) => {
    const layerId = `F_${mermaidSafeId(block.id)}`;
    const layerLabel = escapeMermaidLabel(block.label);
    lines.push(`  ${layerId}["${layerLabel}"]`);
    lines.push(`  class ${layerId} layer`);
    lines.push(`  App --> ${layerId}`);

    block.apis.slice(0, 4).forEach((api) => {
      const apiId = `A_${mermaidSafeId(api.id)}_${index}`;
      const apiLabel = escapeMermaidLabel(shortApiLabel(api.title));
      lines.push(`  ${apiId}["${apiLabel}"]`);
      lines.push(`  class ${apiId} api`);
      lines.push(`  ${layerId} --> ${apiId}`);
    });
  });

  return lines.join("\n");
}

export const INTENT_VIEW_MODES = [
  { id: "timeline", label: "Timeline", hint: "Diagram + numbered steps" },
  { id: "flows", label: "Flows", hint: "Postman-style canvas" },
  { id: "stack", label: "Stack", hint: "Zapier-style flow" },
];

export const INTENT_VIEW_STORAGE_KEY = "khazak-intent-view";

export function readStoredIntentView() {
  if (typeof window === "undefined") return "timeline";
  const stored = window.localStorage.getItem(INTENT_VIEW_STORAGE_KEY);
  return INTENT_VIEW_MODES.some((m) => m.id === stored) ? stored : "timeline";
}

export function apiHref(api) {
  return (
    api.plugIn?.href ||
    api.hubPath ||
    (api.companyHub && api.categorySlug && api.companySlug
      ? `/browse/${api.categorySlug}/${api.companySlug}/${api.slug || api.id}`
      : `/apis/${api.slug || api.id}`)
  );
}
