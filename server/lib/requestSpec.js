import { normalizeEndpoint } from "./health.js";

const PARAM_HINTS = {
  api: { type: "query", description: "Dataset or API identifier on the provider" },
  period: { type: "query", description: "Year or time period (e.g. 2024)" },
  apiKey: { type: "query", description: "Provider portal API key", sensitive: true },
  source: { type: "query", description: "Pagination or filter payload (often JSON)" },
  limit: { type: "query", description: "Maximum number of records to return" },
  offset: { type: "query", description: "Pagination offset" },
  size: { type: "query", description: "Page size" },
  lang: { type: "query", description: "Response language code" },
  format: { type: "query", description: "Response format (json, xml, …)" },
};

const AUTH_LABELS = {
  none: "No authentication",
  apiKey: "API key",
  bearer: "Bearer token",
  oauth: "OAuth 2.0",
  token: "Access token",
};

function describeParam(name, value) {
  const hint = PARAM_HINTS[name];
  return {
    name,
    in: hint?.type || "query",
    description: hint?.description || `Query parameter \`${name}\``,
    required: name === "apiKey" && value === "YOUR_KEY",
    sensitive: hint?.sensitive || name === "apiKey" || value === "YOUR_KEY",
    example: value === "YOUR_KEY" ? "your-api-key" : value,
    defaultValue: value,
  };
}

export function buildTrySpec(entry) {
  if (!entry.endpoint) {
    return {
      available: false,
      reason: "No live endpoint is catalogued for this API.",
    };
  }

  const endpoint = normalizeEndpoint(entry.endpoint);
  let parsed;
  try {
    parsed = new URL(endpoint);
  } catch {
    return { available: false, reason: "Catalogue endpoint URL is invalid." };
  }

  const parameters = [];
  for (const [name, value] of parsed.searchParams.entries()) {
    parameters.push(describeParam(name, value));
  }

  const auth = {
    type: entry.auth || "none",
    label: AUTH_LABELS[entry.auth] || entry.auth,
    scheme: entry.authDetails?.scheme || entry.auth,
    required: entry.auth !== "none" || entry.endpoint.includes("YOUR_KEY"),
    placement: entry.endpoint.includes("apiKey=") ? "query:apiKey" : entry.auth === "bearer" ? "header:Authorization" : null,
    docs: entry.docs || entry.trust?.sourceUrl || null,
  };

  return {
    available: true,
    method: "GET",
    host: parsed.host,
    path: `${parsed.pathname}${parsed.hash || ""}`,
    baseUrl: `${parsed.protocol}//${parsed.host}`,
    parameters,
    auth,
    headers: [
      { name: "Accept", value: "application/json, text/plain, */*", description: "Requested response types" },
    ],
    defaults: {
      params: Object.fromEntries(parsed.searchParams.entries()),
      headers: { Accept: "application/json, text/plain, */*" },
    },
    notes: [
      "Live try: GET requests only, proxied through Qazaq Stack. Query API keys are supported; Authorization and X-API-Key headers forward when set. POST/OAuth flows need provider docs or Postman export.",
      entry.frequency ? `Update frequency: ${entry.frequency}` : null,
      entry.coverage ? `Coverage: ${entry.coverage}` : null,
      entry.copyable === false ? "Live testing may require provider onboarding." : null,
    ].filter(Boolean),
  };
}

export function buildUrlFromParams(entry, params = {}, apiKey) {
  const base = normalizeEndpoint(entry.endpoint);
  if (!base) return { error: "This catalogue entry has no testable endpoint." };

  let baseParsed;
  try {
    baseParsed = new URL(base);
  } catch {
    return { error: "Invalid catalogue endpoint." };
  }

  const url = new URL(baseParsed.origin + baseParsed.pathname + (baseParsed.hash || ""));

  const merged = { ...Object.fromEntries(baseParsed.searchParams.entries()), ...params };
  for (const [key, value] of Object.entries(merged)) {
    if (value === undefined || value === null || value === "") continue;
    let v = String(value);
    if (key === "apiKey" && apiKey) v = v.replace(/YOUR_KEY/g, apiKey);
    else if (v.includes("YOUR_KEY") && apiKey) v = v.replace(/YOUR_KEY/g, apiKey);
    url.searchParams.set(key, v);
  }

  let finalUrl = url.toString();
  if (apiKey) finalUrl = finalUrl.replace(/YOUR_KEY/g, encodeURIComponent(apiKey));

  if (finalUrl.includes("YOUR_KEY")) {
    return { error: "Provide an API key — the request URL still contains YOUR_KEY." };
  }

  return { url: finalUrl };
}

export function buildCurlPreview(method, url, headers = {}) {
  const lines = [`curl -X ${method} '${url.replace(/'/g, "'\\''")}'`];
  for (const [name, value] of Object.entries(headers)) {
    if (!value) continue;
    lines.push(`  -H '${name}: ${String(value).replace(/'/g, "'\\''")}'`);
  }
  return lines.join(" \\\n");
}
