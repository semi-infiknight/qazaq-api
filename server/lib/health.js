import { SITE_ORIGIN } from "./site.js";

const TIMEOUT_MS = 15000;

export function normalizeEndpoint(url) {
  if (!url) return url;
  return url
    .replace(/^https:\/\/stat\.gov\.kz\/api\/getData\/\?/i, "https://api.stat.gov.kz/getData?")
    .replace(/^https:\/\/stat\.gov\.kz\/api\/getData\?/i, "https://api.stat.gov.kz/getData?");
}

function classifyResponse(response, text, contentType) {
  const status = response?.status ?? 0;

  if (!response || status === 0) {
    return { ok: false, tone: "down", label: "Down", reason: "Network error or timeout" };
  }

  if (status >= 400) {
    return { ok: false, tone: "down", label: "Down", reason: `HTTP ${status}` };
  }

  const trimmed = text.trim();
  const isJson =
    contentType.includes("json") || trimmed.startsWith("{") || trimmed.startsWith("[");
  const isXml =
    contentType.includes("xml") ||
    trimmed.startsWith("<?xml") ||
    trimmed.startsWith("<rss") ||
    trimmed.startsWith("<feed");
  const isHtml =
    contentType.includes("html") || trimmed.startsWith("<!") || trimmed.toLowerCase().startsWith("<html");

  if (isJson || isXml) {
    return { ok: true, tone: "live", label: "Live", reason: isJson ? "JSON response" : "XML response" };
  }

  if (isHtml) {
    return {
      ok: true,
      tone: "reachable",
      label: "Reachable",
      reason: "Portal page (HTML) — not a direct JSON API",
    };
  }

  if (status >= 200 && status < 400) {
    return { ok: true, tone: "reachable", label: "Reachable", reason: "HTTP OK" };
  }

  return { ok: false, tone: "down", label: "Down", reason: `HTTP ${status}` };
}

export async function checkHealth(entry) {
  if (!entry.endpoint || entry.auth !== "none" || entry.copyable === false) {
    return { ok: null, status: null, ms: null, checkedAt: new Date().toISOString(), skipped: true };
  }

  const url = normalizeEndpoint(entry.endpoint);
  const start = Date.now();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: "application/json, application/xml, text/xml, text/plain, */*",
        "User-Agent": `QazaqStack-HealthCheck/1.0 (+${SITE_ORIGIN})`,
      },
      redirect: "follow",
    });
    clearTimeout(timer);

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();
    const classified = classifyResponse(response, text, contentType);

    return {
      ok: classified.ok,
      tone: classified.tone,
      label: classified.label,
      reason: classified.reason,
      status: response.status,
      ms: Date.now() - start,
      checkedAt: new Date().toISOString(),
      url,
    };
  } catch (err) {
    const aborted = err.name === "AbortError";
    return {
      ok: false,
      tone: "down",
      label: "Down",
      reason: aborted ? "Timeout" : "Network error",
      status: 0,
      ms: Date.now() - start,
      checkedAt: new Date().toISOString(),
      url,
    };
  }
}
