import { publicListEntry, tokenize } from "./search.js";
import { createVectorIndex } from "./vectorIndex.js";
import { apiMatchesFeature, buildPlugInContext, capabilityOverlap, getApiCapabilities, getApiPrimaryFeatures } from "./apiCapabilities.js";
import { extractFeatures, featureBlocksFromExtraction } from "./featureExtract.js";

const EXAMPLE_PROMPTS = [
  "Address autocomplete, Kaspi checkout, courier ETA",
  "Food delivery app for Almaty with Kaspi pay and courier ETAs",
  "Geocoding and SMS OTP for signup",
  "Fintech wallet with NBK rates and bank account linking",
  "Marketplace for local sellers with maps and parcel shipping",
];

/** Score floors by index mode (semantic MiniLM vs TF–IDF fallback). */
const THRESHOLDS = {
  semantic: { apiMin: 0.3, noFit: 0.36, requireCapability: 0.42 },
  tfidf: { apiMin: 0.16, noFit: 0.2, requireCapability: 0.24 },
};

/** Typical ~4 strong APIs per feature; allow 2–6 when scores support it (not a fixed slice). */
const TARGET_APIS_PER_FEATURE = 4;
const MIN_APIS_PER_FEATURE = 1;
const MAX_APIS_PER_FEATURE = Math.min(
  Math.max(Number(process.env.SUGGEST_MAX_APIS_PER_FEATURE) || 6, MIN_APIS_PER_FEATURE),
  8,
);
/** Within this band of the top match while filling toward TARGET. */
const API_SCORE_RELATIVE_FLOOR = 0.88;
/** Tighter bar for a 5th/6th card — must be nearly as strong as the best. */
const API_SCORE_RELATIVE_FLOOR_TAIL = 0.94;
/** Stop when the next API is a clear step down from the previous rank. */
const API_SCORE_MAX_GAP = 0.065;

let cachedIndex = null;
let cachedApiCount = 0;

function getIndex(apis) {
  if (!cachedIndex || cachedApiCount !== apis.length) {
    cachedIndex = createVectorIndex(apis);
    cachedApiCount = apis.length;
  }
  return cachedIndex;
}

function normalize(text = "") {
  return text.toLowerCase().replace(/ё/g, "е");
}

function enrichApi(api, feature, scores, userHay) {
  const plugIn = buildPlugInContext(api, feature, userHay);
  return {
    ...publicListEntry(api),
    matchScore: Number(scores.final.toFixed(4)),
    semanticScore: Number(scores.semantic.toFixed(4)),
    capabilityOverlap: Number(scores.overlap.toFixed(4)),
    featureId: feature.id,
    plugIn: {
      why: plugIn.why,
      where: plugIn.where,
      docs: api.docs || api.sourceUrl || null,
      href:
        api.hubPath ||
        (api.companyHub && api.categorySlug && api.companySlug
          ? `/browse/${api.categorySlug}/${api.companySlug}/${api.slug || api.id}`
          : `/apis/${api.slug || api.id}`),
    },
  };
}

function pickStrongApisForFeature(ranked, thresholds) {
  if (!ranked.length) return [];

  const best = ranked[0].final;
  const selected = [];

  for (const row of ranked) {
    if (selected.length >= MAX_APIS_PER_FEATURE) break;

    const relativeFloor =
      selected.length >= TARGET_APIS_PER_FEATURE
        ? API_SCORE_RELATIVE_FLOOR_TAIL
        : API_SCORE_RELATIVE_FLOOR;
    const minScore = Math.max(thresholds.apiMin, best * relativeFloor);

    if (row.final < minScore) {
      if (selected.length >= MIN_APIS_PER_FEATURE) break;
      continue;
    }

    if (selected.length > 0) {
      const prev = selected[selected.length - 1].final;
      const gap = prev - row.final;
      if (gap > API_SCORE_MAX_GAP) {
        if (selected.length >= MIN_APIS_PER_FEATURE) break;
      }
      if (selected.length >= TARGET_APIS_PER_FEATURE && gap > API_SCORE_MAX_GAP * 0.75) {
        break;
      }
    }

    selected.push(row);
  }

  return selected;
}

function rankApiForFeature(api, semanticScore, feature, hay) {
  const caps = getApiCapabilities(api);
  const overlap = capabilityOverlap(caps, feature.capabilityTags);
  const match = apiMatchesFeature(api, feature);
  if (!match.ok) return null;

  const provider = normalize(`${api.provider || ""} ${api.companyName || ""}`);
  const providerBoost =
    feature.providers?.some((p) => hay.includes(p) && provider.includes(p)) ? 0.08 : 0;
  const titleBlob = normalize(api.title || "");
  const titleBoost = feature.keywords?.some((kw) => kw.length > 4 && titleBlob.includes(kw)) ? 0.06 : 0;

  const primaryFeatures = getApiPrimaryFeatures(api);
  const featureListed = primaryFeatures.includes(feature.id);
  const featureBoost = featureListed && overlap > 0 ? 0.14 : 0;

  const finalScore =
    semanticScore * 0.42 +
    overlap * 0.38 +
    (match.overlap > 0 ? 0.12 : 0) +
    providerBoost +
    titleBoost +
    featureBoost;

  return {
    api,
    semantic: semanticScore,
    overlap: Math.max(overlap, match.overlap),
    final: finalScore,
  };
}

async function matchApisForFeature(feature, apis, index, userQuery, hay, thresholds) {
  const featureQuery = [
    feature.label,
    feature.why,
    ...(feature.keywords || []).slice(0, 10),
    userQuery,
  ]
    .filter(Boolean)
    .join(". ");

  const { hits } = await index.search(featureQuery, {
    limit: 48,
    minScore: thresholds.apiMin * 0.85,
  });

  const ranked = [];
  const seen = new Set();

  for (const { api, score } of hits) {
    const row = rankApiForFeature(api, score, feature, hay);
    if (!row) continue;
    if (row.overlap <= 0 && score < thresholds.requireCapability) continue;
    if (row.final < thresholds.apiMin) continue;
    const key = String(api.id || api.slug);
    if (seen.has(key)) continue;
    seen.add(key);
    ranked.push(row);
  }

  ranked.sort(
    (a, b) => b.final - a.final || b.semantic - a.semantic || a.api.title.localeCompare(b.api.title),
  );

  const selected = pickStrongApisForFeature(ranked, thresholds);

  return selected.map((row) =>
    enrichApi(row.api, feature, { final: row.final, semantic: row.semantic, overlap: row.overlap }, hay),
  );
}

function formatFeatureLabels(blocks = []) {
  const labels = blocks.map((b) => b.label).filter(Boolean);
  if (!labels.length) return null;
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

function noFitSuggestions(query, bestScore = 0, reason = "no_feature_fit", matchedBlocks = []) {
  const labelPhrase = formatFeatureLabels(matchedBlocks);
  let summary;
  if (reason === "no_apis_matched") {
    summary = labelPhrase
      ? `We identified product features for “${query}” (${labelPhrase}) but no strong Kazakhstan commercial APIs exist for them yet.`
      : `We identified product features for “${query}” but no strong Kazakhstan commercial APIs exist for them yet.`;
  } else {
    summary = `We don’t have a good API fit for “${query}” in this catalogue. Qazaq Stack focuses on Kazakhstan payments, maps, delivery, banking, travel, weather, telecom, and government open data.`;
  }

  const featurePayload = reason === "no_apis_matched" ? matchedBlocks : [];

  return {
    query,
    fit: false,
    bestScore,
    reason,
    summary,
    examples: EXAMPLE_PROMPTS,
    features: featurePayload,
    intents: featurePayload,
    apis: [],
    total: 0,
  };
}

export async function suggestApis(apis, query = "", { limit = 24 } = {}) {
  const text = String(query || "").trim();
  if (!text) {
    return {
      query: null,
      fit: null,
      bestScore: 0,
      summary:
        "Describe your app or list features — address autocomplete, Kaspi checkout, courier ETA…",
      examples: EXAMPLE_PROMPTS,
      features: [],
      intents: [],
      apis: [],
      total: 0,
    };
  }

  const extracted = await extractFeatures(text);
  if (!extracted.features.length) {
    return {
      ...noFitSuggestions(text, 0, "no_feature_fit"),
      mode: "features",
      summarySource: "template",
    };
  }

  const index = getIndex(apis);
  const mode = index.mode || "tfidf";
  const thresholds = THRESHOLDS[mode] || THRESHOLDS.tfidf;
  const hay = normalize(text);

  const blocks = featureBlocksFromExtraction(extracted);
  let globalBest = 0;

  const matched = await Promise.all(
    blocks.map(async (block) => {
      const feature = extracted.features.find((f) => f.feature.id === block.id)?.feature;
      if (!feature) return block;
      block.apis = await matchApisForFeature(feature, apis, index, text, hay, thresholds);
      return block;
    }),
  );

  for (const block of matched) {
    if (block.apis.length) {
      globalBest = Math.max(globalBest, ...block.apis.map((a) => a.matchScore));
    }
  }

  const featureBlocks = matched.filter((b) => b.apis.length);
  const merged = featureBlocks.flatMap((b) => b.apis).slice(0, limit);

  if (!featureBlocks.length || !merged.length) {
    return {
      ...noFitSuggestions(text, globalBest, "no_apis_matched", matched),
      mode,
      recipes: extracted.recipes,
      summarySource: "template",
    };
  }

  if (globalBest < thresholds.noFit) {
    return {
      ...noFitSuggestions(text, globalBest, "no_feature_fit"),
      mode,
      recipes: extracted.recipes,
      summarySource: "template",
    };
  }

  return {
    query: text,
    fit: true,
    bestScore: globalBest,
    mode,
    recipes: extracted.recipes,
    summarySource: "template",
    examples: EXAMPLE_PROMPTS,
    features: featureBlocks,
    intents: featureBlocks,
    apis: merged,
    total: merged.length,
  };
}

export function suggestExamples() {
  return EXAMPLE_PROMPTS;
}
