import { buildUrlFromParams, buildCurlPreview } from "./requestSpec.js";
import { normalizeEndpoint } from "./health.js";

const MAX_BODY = 256 * 1024;
const TIMEOUT_MS = 15000;
const MAX_HTML_PREVIEW = 4000;

const ALLOWED_REQUEST_HEADERS = new Set([
  "accept",
  "accept-language",
  "authorization",
  "content-type",
  "user-agent",
  "x-api-key",
  "x-requested-with",
]);

export function resolveTryRequest(entry, options = {}) {
  const { url: requestedUrl, params, headers, apiKey, settings } = options;

  if (requestedUrl) {
    return resolveTryUrl(entry, requestedUrl, apiKey, headers);
  }

  const built = buildUrlFromParams(entry, params, apiKey);
  if (built.error) return built;

  return {
    method: "GET",
    url: built.url,
    headers: sanitizeHeaders(headers),
    curl: buildCurlPreview("GET", built.url, sanitizeHeaders(headers)),
    settings: normalizeSettings(settings),
  };
}

function resolveTryUrl(entry, requestedUrl, apiKey, headers) {
  const base = normalizeEndpoint(entry.endpoint);
  if (!base) return { error: "This catalogue entry has no testable endpoint." };

  const url = requestedUrl.trim();
  if (!url) return { error: "URL is required." };

  let baseParsed;
  let urlParsed;
  try {
    baseParsed = new URL(base);
    urlParsed = new URL(url);
  } catch {
    return { error: "Invalid URL." };
  }

  if (urlParsed.protocol !== "https:" && urlParsed.protocol !== "http:") {
    return { error: "Only http(s) URLs are allowed." };
  }

  if (urlParsed.host !== baseParsed.host) {
    return { error: "URL must stay on the same host as the catalogue entry." };
  }

  let finalUrl = url;
  if (apiKey) finalUrl = finalUrl.replace(/YOUR_KEY/g, encodeURIComponent(apiKey));

  if (finalUrl.includes("YOUR_KEY")) {
    return { error: "Provide an API key — the request URL still contains YOUR_KEY." };
  }

  const cleanHeaders = sanitizeHeaders(headers);
  return {
    method: "GET",
    url: finalUrl,
    headers: cleanHeaders,
    curl: buildCurlPreview("GET", finalUrl, cleanHeaders),
    settings: normalizeSettings(settings),
  };
}

function sanitizeHeaders(headers = {}) {
  const out = { Accept: "application/json, text/plain, */*" };
  for (const [name, value] of Object.entries(headers || {})) {
    if (!value) continue;
    const key = name.toLowerCase();
    if (!ALLOWED_REQUEST_HEADERS.has(key)) continue;
    out[name] = String(value);
  }
  return out;
}

function normalizeSettings(settings = {}) {
  return {
    followRedirects: settings.followRedirects !== false,
    sslVerification: settings.sslVerification !== false,
    encodeUrl: settings.encodeUrl !== false,
    disableCookieJar: settings.disableCookieJar === true,
    timeout: Math.max(1000, Math.min(60000, Number(settings.timeout) || TIMEOUT_MS)),
  };
}

export async function proxyRequest(method, url, headers = {}, settings = {}) {
  const start = Date.now();
  const normalized = normalizeSettings(settings);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), normalized.timeout);

  try {
    const response = await fetch(url, {
      method: method || "GET",
      signal: controller.signal,
      headers,
      redirect: normalized.followRedirects ? "follow" : "manual",
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location") || "";
      clearTimeout(timer);
      return {
        ok: false,
        status: response.status,
        statusText: response.statusText || "Redirect",
        ms: Date.now() - start,
        contentType: response.headers.get("content-type"),
        format: "text",
        body: location
          ? `Redirect blocked (${response.status}) → ${location}\n\nLive try does not follow cross-origin redirects. Open the provider URL directly or use exported Postman collection.`
          : `Redirect blocked (${response.status}). Live try does not follow redirects automatically.`,
        rawBody: location,
        parsed: null,
        headers: {},
        truncated: false,
        size: 0,
        checkedAt: new Date().toISOString(),
        warning: "Redirect response — not followed for security.",
      };
    }

    const responseHeaders = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    const contentType = response.headers.get("content-type") || "";
    const buffer = await response.arrayBuffer();
    clearTimeout(timer);

    const truncated = buffer.byteLength > MAX_BODY;
    const slice = truncated ? buffer.slice(0, MAX_BODY) : buffer;
    const text = new TextDecoder().decode(slice);

    let body = text;
    let parsed = null;
    let format = "text";

    if (contentType.includes("json") || text.trim().startsWith("{") || text.trim().startsWith("[")) {
      try {
        parsed = JSON.parse(text);
        body = JSON.stringify(parsed, null, 2);
        format = "json";
      } catch {
        format = "text";
      }
    } else if (contentType.includes("xml") || text.trim().startsWith("<")) {
      format = "xml";
      if (text.length > MAX_HTML_PREVIEW) {
        body = `${text.slice(0, MAX_HTML_PREVIEW)}\n\n… (${text.length.toLocaleString()} chars total)`;
      }
    } else if (contentType.includes("html") || text.trim().startsWith("<!")) {
      format = "html";
      body = `${text.slice(0, MAX_HTML_PREVIEW)}\n\n… (${text.length.toLocaleString()} chars total, HTML preview)`;
    } else if (text.length > MAX_HTML_PREVIEW) {
      body = `${text.slice(0, MAX_HTML_PREVIEW)}\n\n… (${text.length.toLocaleString()} chars total)`;
    }

    let warning = null;
    if (format === "html" || (contentType.includes("html") && !parsed)) {
      warning =
        "This response is an HTML page, not JSON data. The endpoint may be wrong or the provider now requires an API key — check the docs link on this page.";
    }

    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      ms: Date.now() - start,
      contentType,
      format,
      body,
      rawBody: text,
      parsed,
      headers: responseHeaders,
      truncated,
      size: buffer.byteLength,
      checkedAt: new Date().toISOString(),
      warning,
    };
  } catch (err) {
    clearTimeout(timer);
    const aborted = err.name === "AbortError";
    return {
      ok: false,
      status: 0,
      statusText: aborted ? "Timeout" : "Network error",
      ms: Date.now() - start,
      contentType: null,
      format: "text",
      body: aborted ? `Request timed out after ${TIMEOUT_MS / 1000}s.` : String(err.message || err),
      rawBody: aborted ? `Request timed out after ${TIMEOUT_MS / 1000}s.` : String(err.message || err),
      parsed: null,
      headers: {},
      truncated: false,
      size: 0,
      checkedAt: new Date().toISOString(),
    };
  }
}
