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

// Timeline / Stack / Mermaid views removed — Flows-only intent results.
// export function shortApiLabel(title = "") { ... }
// export function buildStackMermaid(suggestion, { direction = "LR" } = {}) { ... }
// export const INTENT_VIEW_MODES = [...];
// export const INTENT_VIEW_STORAGE_KEY = "khazak-intent-view";

export function apiHref(api) {
  return (
    api.plugIn?.href ||
    api.hubPath ||
    (api.companyHub && api.categorySlug && api.companySlug
      ? `/browse/${api.categorySlug}/${api.companySlug}/${api.slug || api.id}`
      : `/apis/${api.slug || api.id}`)
  );
}
